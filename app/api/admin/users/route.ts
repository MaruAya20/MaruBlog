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
  const pageRaw = Number(searchParams.get("page") || "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") || "30");
  const q = (searchParams.get("q") || "").trim();

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(100, pageSizeRaw)
      : 30;

  const where: any = {};
  if (q) {
    const key = q.toLowerCase();
    const idNum = Number(key);
    const or: any[] = [
      {
        name: {
          contains: key,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: key,
          mode: "insensitive",
        },
      },
    ];
    if (Number.isFinite(idNum)) {
      or.push({ id: idNum });
    }
    where.OR = or;
  }

  const total = await prisma.user.count({ where });
  const usersRaw = await prisma.user.findMany({
    where,
    orderBy: { id: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // 计算封禁状态：查找 userId 在当前页的所有激活 UserBan 记录
  const ids = usersRaw.map((u) => u.id);
  const now = new Date();
  const bansRaw = ids.length
    ? await prisma.userBan.findMany({
        where: {
          userId: { in: ids },
          OR: [
            { permanent: true },
            { until: { gt: now } },
          ],
        },
        orderBy: { until: "desc" },
      })
    : [];

  const banMap = new Map<
    number,
    { until: string; reason?: string; permanent?: boolean }
  >();
  for (const b of bansRaw) {
    const prev = banMap.get(b.userId);
    if (!prev) {
      banMap.set(b.userId, {
        until: b.until.toISOString(),
        reason: b.reason || undefined,
        permanent: !!b.permanent,
      });
    } else {
      // 已存在永久封禁就不覆盖
      if (prev.permanent) continue;
      if (b.permanent || b.until > new Date(prev.until)) {
        banMap.set(b.userId, {
          until: b.until.toISOString(),
          reason: b.reason || undefined,
          permanent: !!b.permanent,
        });
      }
    }
  }

  const users = usersRaw.map((u) => ({
    id: u.id,
    name: u.name ?? undefined,
    email: u.email ?? undefined,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    stats:
      u.statsDate || u.postsToday !== null || u.xpToday !== null
        ? {
            date: u.statsDate || "",
            postsToday: u.postsToday ?? undefined,
            xpToday: u.xpToday ?? undefined,
          }
        : null,
    ban: banMap.get(u.id) || null,
  }));

  const start = (page - 1) * pageSize;
  const end = start + users.length;

  return NextResponse.json({
    users,
    total,
    page,
    pageSize,
    hasMore: end < total,
  });
}
