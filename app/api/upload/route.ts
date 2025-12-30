import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Base directory for uploaded files
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const THUMB_DIR = path.join(UPLOAD_DIR, "thumbs");

export async function POST(req: NextRequest) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const urlObj = new URL(req.url);
    const kind = (urlObj.searchParams.get("kind") || "other") as
      | "avatar"
      | "wallpaper"
      | "other";

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "invalid content-type" },
        { status: 400 },
      );
    }

    // Read form-data once
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const mime = file.type || "";
    const name = file.name || "";
    const lower = name.toLowerCase();
    const audioExts = [
      ".mp3",
      ".m4a",
      ".aac",
      ".wav",
      ".ogg",
      ".flac",
      ".opus",
      ".weba",
    ];
    const imageExts = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".bmp",
      ".svg",
    ];

    let isImage = mime.startsWith("image/");
    let isAudio = mime.startsWith("audio/");

    if (!isImage && imageExts.some((ext) => lower.endsWith(ext))) {
      isImage = true;
    }
    if (!isAudio && audioExts.some((ext) => lower.endsWith(ext))) {
      isAudio = true;
    }

    if (!isImage && !isAudio) {
      return NextResponse.json(
        {
          error: "unsupported file type",
          detail: {
            mime,
            name,
          },
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit audio size to 10MB
    if (isAudio && buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "audio file too large",
          detail: { limit: 10 * 1024 * 1024, size: buffer.length, name },
        },
        { status: 400 },
      );
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    let filename: string;
    let storedSize = buffer.length;
    let storedMime = mime;
    let thumbFilename: string | null = null;

    if (isImage) {
      // For images: generate compressed main image + thumbnail
      fs.mkdirSync(THUMB_DIR, { recursive: true });
      const baseName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      // 检测是否为 GIF
      const isGif = mime === 'image/gif' || lower.endsWith('.gif');

      if (isGif) {
        // GIF 图片：保持 GIF 格式，防止动画丢失
        filename = `${baseName}.gif`;
        thumbFilename = `${baseName}.thumb.gif`;

        // 主图：最大 1920x1920，保持 GIF 格式
        const mainBuffer = await sharp(buffer, { failOnError: false })
          .resize({
            width: 1920,
            height: 1920,
            fit: "inside",
            withoutEnlargement: true,
          })
          .gif()  // 保持 GIF 格式
          .toBuffer();

        // 缩略图：400x400 方形，保持 GIF 格式
        const thumbBuffer = await sharp(buffer, { failOnError: false })
          .resize(400, 400, { fit: "cover" })
          .gif()  // 保持 GIF 格式
          .toBuffer();

        fs.writeFileSync(path.join(UPLOAD_DIR, filename), mainBuffer);
        fs.writeFileSync(path.join(THUMB_DIR, thumbFilename), thumbBuffer);

        storedSize = mainBuffer.length;
        storedMime = "image/gif";
      } else {
        // 非 GIF 图片：转换为 JPEG 格式
        filename = `${baseName}.jpg`;
        thumbFilename = `${baseName}.thumb.jpg`;

        // Main image: max 1920x1920, JPEG quality ~80
        const mainBuffer = await sharp(buffer, { failOnError: false })
          .resize({
            width: 1920,
            height: 1920,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Thumbnail: 400x400 square, JPEG quality ~75
        const thumbBuffer = await sharp(buffer, { failOnError: false })
          .resize(400, 400, { fit: "cover" })
          .jpeg({ quality: 75 })
          .toBuffer();

        fs.writeFileSync(path.join(UPLOAD_DIR, filename), mainBuffer);
        fs.writeFileSync(path.join(THUMB_DIR, thumbFilename), thumbBuffer);

        storedSize = mainBuffer.length;
        storedMime = "image/jpeg";
      }
    } else {
      // Non-image (audio): write as-is
      const extFromName = file.name.split(".").pop() || "";
      const ext = "." + (extFromName || "bin");
      filename = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    }

    // Read via /api/uploads to avoid relying on Next static public/ caching
    const url = `/api/uploads/${filename}`;
    const thumbUrl =
      thumbFilename != null
        ? `/api/uploads/thumbs/${thumbFilename}`
        : null;

    // Persist Prisma.Upload, consistent with /admin/uploads
    const uploadRow = await prisma.upload.create({
      data: {
        userId: sess.uid,
        kind:
          kind === "avatar"
            ? "AVATAR"
            : kind === "wallpaper"
            ? "WALLPAPER"
            : "OTHER",
        filename,
        url,
        originalName: file.name || null,
        mime: storedMime,
        size: storedSize,
        status: "PENDING",
      },
    });

    // Response compatible with old Store.addUpload, plus thumbUrl hint
    const rec = {
      id: uploadRow.id,
      userId: uploadRow.userId ?? undefined,
      kind,
      filename: uploadRow.filename,
      url: uploadRow.url,
      originalName: uploadRow.originalName || "",
      mime: uploadRow.mime,
      size: uploadRow.size,
      status: uploadRow.status.toLowerCase(),
      createdAt: uploadRow.createdAt.toISOString(),
      thumbUrl,
    };

    return NextResponse.json({ ok: true, upload: rec });
  } catch (err: any) {
    return NextResponse.json(
      { error: "internal_error", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}

