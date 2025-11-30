import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";

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
  const pageSize = Number(searchParams.get("pageSize") || "30");
  const slug = searchParams.get("slug") || undefined;
  const userIdParam = searchParams.get("userId");
  const userId = userIdParam ? Number(userIdParam) : undefined;

  const where: any = {};
  if (slug) {
    where.post = { slug };
  }
  if (typeof userId === "number" && Number.isFinite(userId)) {
    where.userId = userId;
  }

  const total = await prisma.comment.count({ where });
  const p = Number.isFinite(page) && page > 0 ? page : 1;
  const ps =
    Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 30;
  const start = (p - 1) * ps;
  const end = start + ps;

  const rows = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: start,
    take: ps,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          email: true,
        },
      },
      post: {
        select: {
          slug: true,
        },
      },
    },
  });

  // 计算当前页评论的封禁状态（仅针对有 userId 的登录用户）
  const userIds = Array.from(
    new Set(
      rows
        .map((c) => c.userId)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const now = new Date();
  const bannedSet = new Set<number>();
  if (userIds.length) {
    const bans = await prisma.commentBan.findMany({
      where: {
        userId: { in: userIds },
        until: { gt: now },
      },
      select: { userId: true },
    });
    for (const b of bans) {
      if (typeof b.userId === "number") {
        bannedSet.add(b.userId);
      }
    }
  }

  const enriched = rows.map((c) => ({
    id: c.id,
    postSlug: c.post?.slug || "",
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    userId: c.userId ?? undefined,
    guestName: c.guestName ?? undefined,
    banned: c.userId ? bannedSet.has(c.userId) : false,
    user: c.user
      ? {
          id: c.user.id,
          name: c.user.name || undefined,
          role: c.user.role,
          email: c.user.email || undefined,
        }
      : undefined,
  }));

  return NextResponse.json({
    comments: enriched,
    total,
    page: p,
    pageSize: ps,
    hasMore: end < total,
  });
}

// 时间单位：分钟，支持封禁用户或访客 IP
// 时间单位：分钟，支持封禁/解封用户或访客 IP
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

  const body = (await req.json().catch(() => ({}))) as {
    mode?: "ban" | "unban";
    userId?: number;
    ip?: string;
    minutes?: number;
    reason?: string;
  };

  const mode = body.mode || "ban";
  if (!body.userId && !body.ip) {
    return NextResponse.json(
      { error: "missing_target" },
      { status: 400 },
    );
  }

  // 管理员账号不得被评论封禁（但可以解封）
  if (mode === "ban" && body.userId) {
    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { role: true },
    });
    if (target?.role === "ADMIN") {
      return NextResponse.json(
        { error: "cannot_ban_admin_comments" },
        { status: 400 },
      );
    }
  }

  // 解封逻辑：直接删除对应的 CommentBan 记录
  if (mode === "unban") {
    const where: any = {};
    if (body.userId) where.userId = body.userId;
    if (body.ip) where.ip = body.ip;
    await prisma.commentBan.deleteMany({ where });

    await addAdminLogDb({
      adminId: sess.uid,
      action: "comment_unban",
      targetType: "comment",
      targetId: body.userId ?? body.ip ?? "",
      detail: "解除评论封禁",
    });

    return NextResponse.json({ ok: true, unbanned: true });
  }

  const minutesRaw = body.minutes ?? 60;
  const minutes =
    Number.isFinite(minutesRaw) && minutesRaw > 0
      ? minutesRaw
      : 60;

  const untilDate = new Date(
    Date.now() + minutes * 60_000,
  );

  const ban = await prisma.commentBan.create({
    data: {
      userId: body.userId ?? null,
      ip: body.ip || null,
      until: untilDate,
      reason: body.reason || null,
    },
  });

  await addAdminLogDb({
    adminId: sess.uid,
    action: "comment_ban",
    targetType: "comment",
    targetId: body.userId ?? body.ip ?? "",
    detail: `until=${untilDate.toISOString()}; reason=${body.reason || ""}`,
  });

  return NextResponse.json({
    ok: true,
    ban: {
      id: ban.id,
      userId: ban.userId ?? undefined,
      ip: ban.ip ?? undefined,
      until: ban.until.toISOString(),
      reason: ban.reason || "",
      createdAt: ban.createdAt.toISOString(),
    },
  });
}
