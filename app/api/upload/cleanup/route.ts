import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { urls?: string[] };
  const urls = Array.isArray(body.urls)
    ? body.urls.filter(
        (u) => typeof u === "string" && u.startsWith("/"),
      )
    : [];

  if (!urls.length) {
    return NextResponse.json({ ok: true, removed: 0 });
  }

  // 仅考虑当前用户的上传记录
  const [posts, uploads] = await Promise.all([
    prisma.post.findMany({
      select: { content: true },
    }),
    prisma.upload.findMany({
      where: {
        userId: sess.uid,
        url: { in: urls },
      },
    }),
  ]);

  const contentHas = (u: string) =>
    posts.some((p) => String(p.content || "").includes(u));

  const pubDir = path.join(process.cwd(), "public");
  let removed = 0;

  for (const rec of uploads) {
    const url = String(rec.url || "");

    // 如果资源仍然被任意文章引用，则跳过删除
    if (contentHas(url)) continue;

    // 删除物理文件（仅限 /uploads/ 下的文件）
    try {
      if (url.startsWith("/uploads/")) {
        const filePath = path.join(pubDir, url.replace(/^\//, ""));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // 文件删除失败可以忽略，继续删库记录
    }

    await prisma.upload.delete({
      where: { id: rec.id },
    });
    removed++;
  }

  return NextResponse.json({ ok: true, removed });
}
