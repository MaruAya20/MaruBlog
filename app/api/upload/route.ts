import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Always write into the app's public/uploads directory
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

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

    // 只读取一次表单，避免重复消费 body
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const mime = file.type || "";
    const name = file.name || "";
    const lower = name.toLowerCase();
    const audioExts = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac", ".opus", ".weba"];
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];

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

    // 音频大小限制：≤ 10MB
    if (isAudio && buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "audio file too large",
          detail: { limit: 10 * 1024 * 1024, size: buffer.length, name },
        },
        { status: 400 },
      );
    }

    const extFromName = file.name.split(".").pop() || "";
    const ext = "." + (extFromName || (isAudio ? "mp3" : "png"));
    const filename =
      `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

    // 统一通过 /api/uploads 读取，避免依赖 Next.js 对 public/ 的静态缓存
    const url = `/api/uploads/${filename}`;

    // 写入 Prisma.Upload，保持与后台 /admin/uploads 统一的记录
    const uploadRow = await prisma.upload.create({
      data: {
        userId: sess.uid,
        kind: kind === "avatar"
          ? "AVATAR"
          : kind === "wallpaper"
          ? "WALLPAPER"
          : "OTHER",
        filename,
        url,
        originalName: file.name || null,
        mime,
        size: buffer.length,
        status: "PENDING",
      },
    });

    // 保持与旧 Store.addUpload 返回结构兼容
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
    };

    return NextResponse.json({ ok: true, upload: rec });
  } catch (err: any) {
    return NextResponse.json(
      { error: "internal_error", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
