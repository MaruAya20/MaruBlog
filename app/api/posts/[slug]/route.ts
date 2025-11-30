import { NextRequest, NextResponse } from "next/server";
import { getPostBySlug as getMdxPost } from "@/lib/posts";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 读取单篇文章：优先 MDX，其次数据库（不再回退 JSON）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const mdx = getMdxPost(slug);
  if (mdx) {
    return NextResponse.json({ post: mdx });
  }

  const dbp = await prisma.post.findUnique({
    where: { slug },
  });
  if (!dbp) {
    return NextResponse.json(
      { error: "Not Found" },
      { status: 404 },
    );
  }

  const effectiveAt = dbp.scheduledAt ?? dbp.publishedAt;
  return NextResponse.json({
    post: {
      slug: dbp.slug,
      title: dbp.title,
      excerpt: dbp.excerpt || undefined,
      content: dbp.content,
      tags: dbp.tags || [],
      publishedAt: effectiveAt.toISOString(),
      status: dbp.status as "draft" | "published",
      scheduledAt: dbp.scheduledAt
        ? dbp.scheduledAt.toISOString()
        : undefined,
      authorId: dbp.authorId,
    },
  });
}

export async function PATCH(
  req: NextRequest,
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

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: string[];
    status?: "draft" | "published";
    scheduledAt?: string;
  };

  // 解析并验证 scheduledAt
  let normalizedScheduled: string | undefined;
  if (Object.prototype.hasOwnProperty.call(body, "scheduledAt")) {
    const val = body.scheduledAt;
    if (typeof val === "string" && val.trim()) {
      const t = Date.parse(String(val));
      if (!Number.isFinite(t) || t <= Date.now()) {
        return NextResponse.json(
          { error: "scheduledAt must be a future time" },
          { status: 400 },
        );
      }
      normalizedScheduled = new Date(t).toISOString();
    } else {
      normalizedScheduled = undefined;
    }
  }

  // 通过数据库检查文章和作者
  const existing = await prisma.post.findUnique({
    where: { slug },
    select: {
      id: true,
      authorId: true,
    },
  });
  if (!existing) {
    // 与旧行为保持一致：不泄露文章存在性，用统一错误
    return NextResponse.json(
      { error: "forbidden or not found" },
      { status: 403 },
    );
  }
  const isOwner =
    sess.role === "ADMIN" || existing.authorId === sess.uid;
  if (!isOwner) {
    return NextResponse.json(
      { error: "forbidden or not found" },
      { status: 403 },
    );
  }

  const patch: any = {};
  if (body.title !== undefined) {
    patch.title = String(body.title);
  }
  if (body.content !== undefined) {
    patch.content = String(body.content);
  }
  if (body.excerpt !== undefined) {
    patch.excerpt = body.excerpt || null;
  }
  if (body.tags !== undefined) {
    patch.tags = Array.isArray(body.tags) ? body.tags : [];
  }
  if (body.status !== undefined) {
    patch.status =
      body.status === "draft" ? "draft" : "published";
  }
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "scheduledAt",
    )
  ) {
    patch.scheduledAt = normalizedScheduled
      ? new Date(normalizedScheduled)
      : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "nothing_to_update" },
      { status: 400 },
    );
  }

  const updated = await prisma.post.update({
    where: { slug },
    data: patch,
  });

  const effectiveAt =
    updated.scheduledAt ?? updated.publishedAt;
  const post = {
    slug: updated.slug,
    title: updated.title,
    excerpt: updated.excerpt || undefined,
    content: updated.content,
    tags: updated.tags || [],
    publishedAt: effectiveAt.toISOString(),
    status: updated.status as "draft" | "published",
    scheduledAt: updated.scheduledAt
      ? updated.scheduledAt.toISOString()
      : undefined,
    authorId: updated.authorId,
  };

  return NextResponse.json({ post });
}

export async function DELETE(
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
    select: {
      id: true,
      authorId: true,
    },
  });
  if (!post) {
    return NextResponse.json(
      { error: "forbidden or not found" },
      { status: 403 },
    );
  }

  const isOwner =
    sess.role === "ADMIN" || post.authorId === sess.uid;
  if (!isOwner) {
    return NextResponse.json(
      { error: "forbidden or not found" },
      { status: 403 },
    );
  }

  // 先删除关联的评论 / 点赞 / 收藏，再删除文章
  await prisma.comment.deleteMany({
    where: { postId: post.id },
  });
  await prisma.like.deleteMany({
    where: { postId: post.id },
  });
  await prisma.favorite.deleteMany({
    where: { postId: post.id },
  });

  await prisma.post.delete({
    where: { id: post.id },
  });

  return NextResponse.json({ ok: true });
}

