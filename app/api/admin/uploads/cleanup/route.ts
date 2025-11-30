import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminElevation } from "@/lib/adminGuard";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: NextRequest) {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const st = await getAdminElevation(sess.uid);
  if (!st.elevated) {
    return NextResponse.json(
      { error: "elevation_required" },
      { status: 403 },
    );
  }

  const posts = await prisma.post.findMany({
    select: { content: true },
  });
  const users = await prisma.user.findMany({
    select: { avatar: true },
  });
  const prefs = await prisma.userPreference.findMany({
    select: { wallpaper: true },
  });
  const uploads = await prisma.upload.findMany();
  const pubDir = path.join(process.cwd(), "public");

  const isUrlUsedByPosts = (url: string) =>
    posts.some((p) => String(p.content || "").includes(url));

  const isUrlUsedByAvatar = (url: string) =>
    users.some((u: any) => (u.avatar || "") === url);

  const isUrlUsedByWallpaperPref = (url: string) =>
    prefs.some((p) => (p.wallpaper || "") === url);

  const removed: { id: number; url: string }[] = [];

  for (const rec of uploads) {
    const url = String(rec.url || "");
    let used = false;

    if (rec.kind === "AVATAR") {
      used = isUrlUsedByAvatar(url);
    } else if (rec.kind === "WALLPAPER") {
      used = isUrlUsedByWallpaperPref(url);
    } else {
      // 其他资源：按是否出现在任意文章内容中判断
      used = isUrlUsedByPosts(url);
    }

    if (used) {
      continue;
    }

    // 未被使用：尝试删除文件（仅删除 /uploads/ 下的文件）
    try {
      if (url.startsWith("/uploads/")) {
        const filePath = path.join(pubDir, url.replace(/^\//, ""));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // 忽略文件删除错误，继续逻辑
    }
    removed.push({ id: rec.id, url });

    await prisma.upload.delete({
      where: { id: rec.id },
    });
  }

  return NextResponse.json({
    ok: true,
    removedCount: removed.length,
    removed,
  });
}
