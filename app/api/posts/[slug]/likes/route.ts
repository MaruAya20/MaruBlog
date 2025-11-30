import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { awardXpDb } from "@/lib/xpDb";

// 使用 PostgreSQL Like 表作为点赞来源，JSON 仅用于 XP 等兼容逻辑
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sess = await getSession();

  const post = await prisma.post.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!post) {
    // 兼容旧行为：不存在时返回 0 / false，避免前端直接 500
    return NextResponse.json({ count: 0, liked: false });
  }

  const count = await prisma.like.count({
    where: { postId: post.id },
  });

  let liked = false;
  if (sess) {
    try {
      const existing = await prisma.like.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: sess.uid,
          },
        },
      });
      liked = !!existing;
    } catch {
      liked = false;
    }
  }

  return NextResponse.json({ count, liked });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const post = await prisma.post.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!post) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  // 切换点赞状态（有则删，无则增）
  let liked = false;
  try {
    const existing = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: sess.uid,
        },
      },
    });

    if (existing) {
      await prisma.like.delete({
        where: { id: existing.id },
      });
      liked = false;
    } else {
      await prisma.like.create({
        data: {
          postId: post.id,
          userId: sess.uid,
        },
      });
      liked = true;

      // XP 奖励：每个用户对同一篇文章只奖励一次
      try {
        const existedAward = await prisma.userLikedAward.findFirst({
          where: {
            userId: sess.uid,
            title: post.slug,
          },
        });
        if (!existedAward) {
          await prisma.userLikedAward.create({
            data: {
              userId: sess.uid,
              title: post.slug,
            },
          });
          await awardXpDb(sess.uid, 10);
        }
      } catch {
        // 忽略 XP 奖励错误，避免影响点赞主流程
      }
    }
  } catch {
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }

  const count = await prisma.like.count({
    where: { postId: post.id },
  });

  return NextResponse.json({ liked, count });
}
