import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";

/**
 * 使用 Prisma 深度删除用户及其关联数据，并清理物理文件。
 * - 不允许删除 ADMIN 账号；
 * - 会删除该用户的文章、评论、点赞 / 收藏、偏好、封禁、上传、登录码等；
 * - PageView 等采用外键 ON DELETE SET NULL，不额外处理。
 */
export async function deleteUserDeepDb(
  userId: number,
): Promise<{ ok: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      avatar: true,
    },
  });
  if (!user) {
    return { ok: false, reason: "not_found" };
  }
  if (user.role === "ADMIN") {
    return { ok: false, reason: "cannot_delete_admin" };
  }

  // 收集该用户发表的文章及其内容用于媒体 URL 清理
  const posts = await prisma.post.findMany({
    where: { authorId: userId },
    select: {
      id: true,
      slug: true,
      content: true,
    },
  });
  const postIds = posts.map((p) => p.id);
  const postSlugs = new Set(posts.map((p) => p.slug));

  // 从文章内容中提取 /uploads/ 下的资源 URL
  const mediaUrls = new Set<string>();
  const re = /\((\/uploads\/[^)]+)\)|src=\"(\/uploads\/[^\"]+)\"/g;
  for (const p of posts) {
    const content = String(p.content || "");
    for (const m of content.matchAll(re)) {
      const url = (m[1] || m[2] || "").trim();
      if (url) mediaUrls.add(url);
    }
  }

  // 收集头像和壁纸 URL
  const urlsToDelete = new Set<string>();
  const pushUrl = (url?: string | null) => {
    if (!url) return;
    const s = String(url);
    if (!s.startsWith("/uploads/")) return;
    urlsToDelete.add(s);
  };
  pushUrl(user.avatar);

  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { wallpaper: true },
  });
  if (pref?.wallpaper) {
    pushUrl(pref.wallpaper);
  }
  for (const url of mediaUrls) urlsToDelete.add(url);

  // 删除与该用户相关的评论（自己写的 + 自己文章下的）
  if (postIds.length) {
    await prisma.comment.deleteMany({
      where: {
        OR: [{ userId }, { postId: { in: postIds } }],
      },
    });
  } else {
    await prisma.comment.deleteMany({
      where: { userId },
    });
  }

  // 删除点赞 / 收藏（自己点赞 + 自己文章上的）
  if (postIds.length) {
    await prisma.like.deleteMany({
      where: {
        OR: [{ userId }, { postId: { in: postIds } }],
      },
    });
    await prisma.favorite.deleteMany({
      where: {
        OR: [{ userId }, { postId: { in: postIds } }],
      },
    });
  } else {
    await prisma.like.deleteMany({ where: { userId } });
    await prisma.favorite.deleteMany({ where: { userId } });
  }

  // 删除所有文章
  if (postIds.length) {
    await prisma.post.deleteMany({
      where: { id: { in: postIds } },
    });
  }

  // 删除所有 likedAward 记录：
  // - 标记了该用户文章 slug 的记录（title 中存的是 slug）
  // - 以及以该用户为 userId 的记录（避免外键约束错误）
  if (postSlugs.size) {
    await prisma.userLikedAward.deleteMany({
      where: { title: { in: Array.from(postSlugs) } },
    });
  }
  await prisma.userLikedAward.deleteMany({
    where: { userId },
  });

  // 删除用户偏好
  await prisma.userPreference.deleteMany({
    where: { userId },
  });

  // 清理封禁记录 / 管理会话 / 日志 / 登录验证码
  await prisma.commentBan.deleteMany({ where: { userId } });
  await prisma.userBan.deleteMany({ where: { userId } });
  await prisma.adminSession.deleteMany({ where: { userId } });
  await prisma.adminLog.deleteMany({ where: { adminId: userId } });
  if (user.email) {
    await prisma.loginCode.deleteMany({
      where: { email: user.email },
    });
  }

  // 删除该用户拥有的上传记录，以及与其文章 / 头像 / 壁纸相关的上传，并清理物理文件
  const uploads = await prisma.upload.findMany({
    where: {
      OR: [
        { userId },
        { url: { in: Array.from(urlsToDelete) } },
      ],
    },
  });
  const uploadIds: number[] = [];
  const pubDir = path.join(process.cwd(), "public");
  for (const u of uploads) {
    const url = String(u.url || "");
    uploadIds.push(u.id);
    if (url.startsWith("/uploads/")) {
      const filePath = path.join(pubDir, url.replace(/^\//, ""));
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // 忽略文件删除错误
      }
    }
  }
  if (uploadIds.length) {
    await prisma.upload.deleteMany({
      where: { id: { in: uploadIds } },
    });
  }

  // 最后删除用户本身
  await prisma.user.delete({
    where: { id: userId },
  });

  return { ok: true };
}

