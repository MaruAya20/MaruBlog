import { NextRequest, NextResponse } from "next/server";
import { Store } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTagStyle } from "@/lib/tagStyle";
import { canPostTodayDb, awardXpDb } from "@/lib/xpDb";

// 列表文章：发现页 / 我的界面等统一使用数据库读取（PostgreSQL），JSON 仅作为备份
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag") || undefined;
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.max(
    1,
    Math.min(50, Number(searchParams.get("pageSize") || "5")),
  );
  const authorIdParam = searchParams.get("authorId");
  const authorId = authorIdParam ? Number(authorIdParam) : undefined;
  const includeDraftParam =
    searchParams.get("includeDraft") === "1";
  const favorited = searchParams.get("favorited") === "1";
  const q = searchParams.get("q") || undefined;

  let favoritedBy: number | undefined = undefined;
  if (favorited) {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({
        posts: [],
        total: 0,
        page,
        pageSize,
        hasMore: false,
      });
    }
    favoritedBy = sess.uid;
  }

  // includeDraft 仅允许作者本人查看自己的草稿
  let includeDraft = false;
  if (includeDraftParam) {
    const sess = await getSession();
    includeDraft = !!(authorId && sess && sess.uid === authorId);
  }

  const now = new Date();

  const where: any = {};

  // 发布状态过滤：默认仅展示已发布或已到期的定时文章
  if (!includeDraft) {
    where.OR = [
      { status: "published" },
      {
        AND: [
          { status: "draft" },
          { scheduledAt: { not: null, lte: now } },
        ],
      },
    ];
  }

  if (tag) {
    where.tags = { has: tag };
  }
  if (typeof authorId === "number" && !Number.isNaN(authorId)) {
    where.authorId = authorId;
  }
  if (typeof favoritedBy === "number") {
    where.favorites = { some: { userId: favoritedBy } };
  }
  if (q && q.trim()) {
    const qs = q.toLowerCase();
    where.AND = (where.AND || []).concat([
      {
        OR: [
          { title: { contains: qs, mode: "insensitive" } },
          { excerpt: { contains: qs, mode: "insensitive" } },
          { content: { contains: qs, mode: "insensitive" } },
          { tags: { has: q } },
        ],
      },
    ]);
  }

  const total = await prisma.post.count({ where });
  const postsRaw = await prisma.post.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
          xp: true,
        },
      },
      _count: {
        select: {
          likes: true,
          favorites: true,
        },
      },
    },
  });

  // 为当前页涉及的所有标签构建样式映射，优先使用 TagDef 中的颜色，缺失时回退 getTagStyle
  const allTagNames = new Set<string>();
  for (const p of postsRaw) {
    for (const t of (p.tags || []) as string[]) {
      const name = (t || "").trim();
      if (name) allTagNames.add(name);
    }
  }

  const tagStyleMap: Record<
    string,
    { bg: string; color: string; border: string }
  > = {};
  if (allTagNames.size > 0) {
    const defs = await prisma.tagDef.findMany({
      where: { name: { in: Array.from(allTagNames) } },
    });
    for (const d of defs) {
      const fallback = getTagStyle(d.name);
      tagStyleMap[d.name] = {
        bg: d.bg || fallback.bg,
        color: d.color || fallback.color,
        border: d.border || fallback.border,
      };
    }
  }

  const posts = postsRaw.map((p) => {
    const imgs = Array.from(
      String(p.content || "").matchAll(/!\[[^\]]*]\(([^)]+)\)/g),
    )
      .slice(0, 3)
      .map((m) => m[1] as string);
    const effectiveAt = p.scheduledAt ?? p.publishedAt;

    const tagsArray = (p.tags || []) as string[];
    const tagStyles: Record<
      string,
      { bg: string; color: string; border: string }
    > = {};
    for (const t of tagsArray) {
      const name = (t || "").trim();
      if (!name) continue;
      tagStyles[name] =
        tagStyleMap[name] || getTagStyle(name);
    }

    const thumbs = imgs.map((url) => {
      // 仅对本站 /api/uploads/ 生成缩略图 URL，其它外链保持原样
      if (url.startsWith("/api/uploads/")) {
        const rest = url.slice("/api/uploads/".length); // e.g. "abc.jpg"
        if (rest.startsWith("thumbs/")) return url;
        const lastDot = rest.lastIndexOf(".");
        if (lastDot === -1) return url;
        const base = rest.slice(0, lastDot); // "abc"
        const ext = rest.slice(lastDot); // ".jpg"
        return `/api/uploads/thumbs/${base}.thumb${ext}`;
      }
      return url;
    });

    return {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || undefined,
      content: p.content,
      tags: tagsArray,
      publishedAt: effectiveAt.toISOString(),
      date: effectiveAt.toISOString(),
      status: p.status,
      scheduledAt: p.scheduledAt
        ? p.scheduledAt.toISOString()
        : undefined,
      authorId: p.authorId,
      previewImages: imgs,
      previewThumbs: thumbs,
      likes: (p as any)._count?.likes ?? 0,
      favorites: (p as any)._count?.favorites ?? 0,
      tagStyles,
      author: p.author
        ? {
            id: p.author.id,
            name: p.author.name,
            avatar: p.author.avatar,
            role: p.author.role,
            level: Store.getLevelFromXp(p.author.xp),
          }
        : undefined,
    };
  });

  const hasMore = page * pageSize < total;
  return NextResponse.json({
    posts,
    total,
    page,
    pageSize,
    hasMore,
  });
}

// 发文 / 草稿 / 定时发布：仅通过 Prisma 写入数据库
export async function POST(req: NextRequest) {
  const sess = await getSession();
  const body = (await req.json().catch(() => ({}))) as {
    authorId?: number | string;
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: any;
    status?: "draft" | "published";
    scheduledAt?: string;
  };
  const {
    authorId,
    title,
    content,
    excerpt,
    tags,
    status,
    scheduledAt,
  } = body;

  if (!authorId || !title || !content) {
    return NextResponse.json(
      { error: "missing fields" },
      { status: 400 },
    );
  }
  if (
    !sess ||
    (sess.uid !== Number(authorId) &&
      sess.role !== "ADMIN")
  ) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  // 发文频率限制：完全基于 Prisma.User
  const can = await canPostTodayDb(
    Number(authorId),
    sess.role === "ADMIN",
  );
  if (!can) {
    return NextResponse.json(
      { error: "post limit reached" },
      { status: 429 },
    );
  }

  const tlist = Array.isArray(tags)
    ? tags.map(String)
    : typeof tags === "string" && tags
      ? tags
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

  // validate scheduledAt (must be future if provided)
  let schedIso: string | undefined = undefined;
  if (typeof scheduledAt === "string" && scheduledAt.trim()) {
    const t = Date.parse(String(scheduledAt));
    if (!Number.isFinite(t) || t <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt must be a future time" },
        { status: 400 },
      );
    }
    schedIso = new Date(t).toISOString();
  }

  // 生成 slug，与旧 Store.createPost 逻辑保持一致
  const titleStr = String(title);
  const base = titleStr
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fa5\-]/g, "");
  const slugBase =
    base && base.length > 0 ? base : `post-${Date.now()}`;
  let slug = slugBase;
  let i = 1;
  // 确保 slug 在数据库中唯一
  // （文章数量有限，这里的 while 查询成本可以接受）
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.post.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) break;
    slug = `${slugBase}-${++i}`;
  }

  const now = new Date();
  const statusNorm =
    status === "draft" ? "draft" : "published";
  const scheduledAtDate =
    statusNorm === "draft" && schedIso
      ? new Date(schedIso)
      : null;

  const created = await prisma.post.create({
    data: {
      slug,
      title: titleStr,
      excerpt: excerpt || null,
      content: String(content),
      tags: tlist,
      publishedAt: now,
      status: statusNorm,
      scheduledAt: scheduledAtDate,
      authorId: Number(authorId),
    },
  });

  if (sess.role !== "ADMIN" && statusNorm !== "draft") {
    try {
      await awardXpDb(sess.uid, 50);
    } catch {
      // 忽略 XP 更新错误，避免影响发文主流程
    }
  }

  const effectiveAt =
    created.scheduledAt ?? created.publishedAt;
  const post = {
    slug: created.slug,
    title: created.title,
    excerpt: created.excerpt || undefined,
    content: created.content,
    tags: (created.tags as string[]) || [],
    publishedAt: effectiveAt.toISOString(),
    status: created.status as "draft" | "published",
    scheduledAt: created.scheduledAt
      ? created.scheduledAt.toISOString()
      : undefined,
    authorId: created.authorId,
  };

  return NextResponse.json({ post });
}
