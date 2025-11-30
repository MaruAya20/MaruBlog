import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

async function cleanupOldWallpaper(
  oldUrl: string | undefined | null,
  userId: number | undefined | null,
) {
  const url = (oldUrl || "").toString();
  // 只删除用户上传的壁纸文件（/uploads/ 下的资源），默认 wallpaper.jpg 或外链不会被删除
  if (!url || !url.startsWith("/uploads/")) return;
  if (!userId) return;

  const pubDir = path.join(process.cwd(), "public");

  const uploads = await prisma.upload.findMany({
    where: {
      userId,
      kind: "WALLPAPER",
      url,
    },
  });

  for (const rec of uploads) {
    try {
      const filePath = path.join(pubDir, rec.url.replace(/^\//, ""));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore file errors
    }
    await prisma.upload.delete({ where: { id: rec.id } });
  }
}

export async function GET(req: NextRequest) {
  const sess = await getSession().catch(() => null);
  // 登录用户：优先使用 DB 中的个人壁纸配置
  if (sess) {
    const pref = await prisma.userPreference.findUnique({
      where: { userId: sess.uid },
    });
    const url = (pref?.wallpaper as string | undefined) || "";
    const opacityRaw = pref?.opacity;
    const opacity =
      typeof opacityRaw === "number"
        ? Math.min(1, Math.max(0, opacityRaw))
        : 0.35;
    return NextResponse.json({ url, opacity });
  }

  // 未登录 / 访客：使用默认壁纸（globals.css 中的 wallpaper.jpg），仅读取透明度 cookie
  const op = req.cookies.get("wp_opacity")?.value;
  const opacity =
    typeof op === "string"
      ? Math.min(1, Math.max(0, Number(op)))
      : 0.35;
  return NextResponse.json({ url: "", opacity });
}

export async function POST(req: NextRequest) {
  const sess = await getSession().catch(() => null);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { url, opacity } = await req.json().catch(() => ({}));

  // 旧壁纸地址优先从 DB 的用户偏好读取，其次回退到 cookie
  const prefForOld = await prisma.userPreference.findUnique({
    where: { userId: sess.uid },
  });
  const oldUrl: string | undefined =
    (prefForOld?.wallpaper as string | undefined) ||
    req.cookies.get("wp_url")?.value;

  const headers = new Headers();
  const nextUrl = String(url || "");
  const nextOpacity = Math.min(
    1,
    Math.max(0, Number(opacity)),
  );

  // 新壁纸 URL 不同于旧值时，清理旧壁纸文件（只删除 /uploads/ 下的文件）
  if (nextUrl && oldUrl && nextUrl !== oldUrl) {
    await cleanupOldWallpaper(oldUrl, sess.uid);
  }

  // 持久化到 DB 中的个人偏好：保证任何时刻每个用户只保留一条壁纸地址
  await prisma.userPreference.upsert({
    where: { userId: sess.uid },
    update: {
      wallpaper: nextUrl || null,
      opacity: Number.isFinite(nextOpacity) ? nextOpacity : null,
    },
    create: {
      userId: sess.uid,
      wallpaper: nextUrl || null,
      opacity: Number.isFinite(nextOpacity) ? nextOpacity : 0.35,
    },
  });

  const res = NextResponse.json(
    { url: nextUrl, opacity: nextOpacity },
    { headers },
  );

  // 仍然同步一份到 cookie，便于旧逻辑与 SSR 读取
  res.cookies.set("wp_url", nextUrl, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set("wp_opacity", String(nextOpacity), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const sess = await getSession().catch(() => null);

  // 删除时同样基于用户偏好中的旧壁纸 URL，必要时回退到 cookie
  let oldUrl: string | undefined;
  if (sess) {
    const prefForOld = await prisma.userPreference.findUnique({
      where: { userId: sess.uid },
    });
    oldUrl = (prefForOld?.wallpaper as string | undefined) || undefined;
  }
  if (!oldUrl) {
    oldUrl = req.cookies.get("wp_url")?.value;
  }
  if (sess) {
    await cleanupOldWallpaper(oldUrl, sess.uid);
  }

  // 清空 DB 中的个人偏好
  if (sess) {
    try {
      await prisma.userPreference.update({
        where: { userId: sess.uid },
        data: {
          wallpaper: null,
          opacity: null,
        },
      });
    } catch {
      // ignore if not exists
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("wp_url", "", { path: "/", maxAge: 0 });
  res.cookies.set("wp_opacity", "", { path: "/", maxAge: 0 });
  return res;
}

