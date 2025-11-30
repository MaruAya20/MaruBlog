import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminElevation } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "20");
  const q = searchParams.get("q") || undefined;
  const statusFilter = searchParams.get("status") || "all";

  const pageNum =
    Number.isFinite(page) && page > 0 ? page : 1;
  const ps =
    Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20;

  const where: any = {};
  if (q && q.trim()) {
    const qq = q.trim();
    where.OR = [
      { title: { contains: qq, mode: "insensitive" } },
      { content: { contains: qq, mode: "insensitive" } },
      { slug: { contains: qq, mode: "insensitive" } },
    ];
  }

  // 状态过滤：根据 status / scheduledAt 组合判断
  const now = new Date();
  if (statusFilter === "published") {
    where.status = "published";
  } else if (statusFilter === "draft") {
    where.status = "draft";
    where.OR = (where.OR || []).concat([
      {
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ],
      },
    ]);
  } else if (statusFilter === "scheduled") {
    where.status = "draft";
    where.scheduledAt = { gt: now };
  }

  const total = await prisma.post.count({ where });
  const rows = await prisma.post.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    skip: (pageNum - 1) * ps,
    take: ps,
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  const posts = rows.map((p) => {
    const effectiveAt =
      p.scheduledAt && p.status === "draft" && p.scheduledAt > now
        ? p.scheduledAt.toISOString()
        : p.publishedAt.toISOString();
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: (p.status as any) || "published",
      publishedAt: p.publishedAt.toISOString(),
      scheduledAt: p.scheduledAt
        ? p.scheduledAt.toISOString()
        : undefined,
      effectiveAt,
      author: p.author
        ? {
            id: p.author.id,
            name: p.author.name || undefined,
            email: p.author.email || undefined,
            role: p.author.role,
          }
        : undefined,
    };
  });

  return NextResponse.json({
    posts,
    total,
    page: pageNum,
    pageSize: ps,
    hasMore: pageNum * ps < total,
  });
}
