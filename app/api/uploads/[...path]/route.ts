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

req: NextRequest,

{ params }: { params: Promise<{ path: string[] }> },

) {

const { path: segs } = await params;

const rel = (segs || []).join("/");

// 1. 基础安全校验

if (!rel || rel.includes("..")) {

return new NextResponse("Not found", { status: 404 });

}

const baseDir = path.join(process.cwd(), "public", "uploads");

const filePath = path.join(baseDir, rel);

let stat: fs.Stats;

try {

stat = await fs.promises.stat(filePath);

if (!stat.isFile()) {

return new NextResponse("Not found", { status: 404 });

}

} catch {

return new NextResponse("Not found", { status: 404 });

}

const fileSize = stat.size;

const range = req.headers.get("range");

// 2. 处理 Range 请求

if (range) {

// 修正1: 使用更通用的正则表达式

// 支持: bytes=0-, bytes=0-1023, bytes=-500

const match = range.match(/bytes=(\d)-(\d)/);

if (!match) {

return new NextResponse("Invalid range", { status: 400 });

}

const startStr = match[1];
const endStr = match[2];

// 修正2: 正确解析 start 和 end
// 如果 startStr 为空，则 start 为 0
const start = startStr ? parseInt(startStr, 10) : 0;
// 如果 endStr 为空，则 end 为 fileSize - 1
const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

// 边界检查
if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
  return new NextResponse("Range not satisfiable", {
    status: 416,
    headers: { "Content-Range": `bytes */${fileSize}` },
  });
}

const chunkSize = end - start + 1;
const stream = fs.createReadStream(filePath, { start, end });

const headers = {
  "Content-Type": getContentType(filePath),
  "Accept-Ranges": "bytes",
  "Content-Range": `bytes ${start}-${end}/${fileSize}`,
  "Content-Length": chunkSize.toString(),
  "Cache-Control": "public, max-age=0, must-revalidate",
};

return new NextResponse(stream as any, {
  status: 206, // 关键：返回 206 Partial Content
  headers,
});

}

// 3. 处理普通请求 (无 Range 头)

const stream = fs.createReadStream(filePath);

const headers = {

"Content-Type": getContentType(filePath),

"Accept-Ranges": "bytes",

"Content-Length": fileSize.toString(),

"Cache-Control": "public, max-age=0, must-revalidate",

};

return new NextResponse(stream as any, {

status: 200,

headers,

});

}