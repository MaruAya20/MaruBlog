import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// 使用 PostgreSQL Favorite 表作为收藏来源
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
    return NextResponse.json({ count: 0, favorited: false });
  }

  const count = await prisma.favorite.count({
    where: { postId: post.id },
  });

  let favorited = false;
  if (sess) {
    try {
      const existing = await prisma.favorite.findUnique({
        where: {
          postId_userId: {
            postId: post.id,
            userId: sess.uid,
          },
        },
      });
      favorited = !!existing;
    } catch {
      favorited = false;
    }
  }

  return NextResponse.json({ count, favorited });
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
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  let favorited = false;
  try {
    const existing = await prisma.favorite.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: sess.uid,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({
        where: { id: existing.id },
      });
      favorited = false;
    } else {
      await prisma.favorite.create({
        data: {
          postId: post.id,
          userId: sess.uid,
        },
      });
      favorited = true;
    }
  } catch {
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }

  const count = await prisma.favorite.count({
    where: { postId: post.id },
  });

  return NextResponse.json({ favorited, count });
}

