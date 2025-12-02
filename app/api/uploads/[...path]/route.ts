// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".mp3":
    case ".m4a":
      return "audio/mpeg";
    case ".ogg":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    case ".opus":
      return "audio/opus";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const rel = (path || []).join("/");
  // 简单防止目录遍历
  if (!rel || rel.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const baseDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(baseDir, rel);

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await fs.promises.readFile(filePath);
    const contentType = getContentType(filePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Internal error", { status: 500 });
  }
}
