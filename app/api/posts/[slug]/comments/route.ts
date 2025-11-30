import { NextRequest, NextResponse } from "next/server";
import { Store } from "@/lib/store";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsDb } from "@/lib/siteSettingsDb";
import { awardXpDb } from "@/lib/xpDb";

// 统一从 Prisma Comment / CommentBan / RateLimit 读取与写入评论相关数据

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const post = await prisma.post.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ comments: [] });
  }

  const rows = await prisma.comment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
          signature: true,
          xp: true,
        },
      },
    },
  });

  const list = rows.map((c) => {
    const u = c.user;
    const level =
      u && typeof (u as any).xp === "number"
        ? (Store as any).getLevelFromXp((u as any).xp)
        : undefined;
    const displayName = c.userId
      ? u?.name || `用户#${c.userId}`
      : c.guestName
        ? String(c.guestName)
        : "访客";

    return {
      id: c.id,
      postSlug: slug,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      userId: c.userId ?? undefined,
      guestName: c.guestName ?? undefined,
      displayName,
      user: u
        ? {
            id: u.id,
            name: u.name,
            role: u.role,
            avatar: u.avatar,
            signature: u.signature,
            level,
          }
        : undefined,
    };
  });

  return NextResponse.json({ comments: list });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sess = await getSession();

  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    guestName?: string;
  };
  const content = String(body.content || "").trim();
  if (!content) {
    return NextResponse.json(
      { error: "empty" },
      { status: 400 },
    );
  }

  const settings = await getSiteSettingsDb();
  // 未登录访客在站点关闭访客评论时禁止发表评论
  if (!sess && !settings.allowGuestComment) {
    return NextResponse.json(
      {
        error: "guest_comment_disabled",
        message: "当前站点暂时关闭访客评论，请登录后再试~",
      },
      { status: 403 },
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

  const now = new Date();
  const nowTs = now.getTime();

  // 解析 IP（用于访客封禁与频率限制）
  const ip =
    !sess
      ? (req.headers
            .get("x-forwarded-for")
            ?.split(",")[0]
            .trim() ||
          req.headers.get("x-real-ip") ||
          "unknown")
      : undefined;

  // 检查评论封禁（按用户或访客 IP）
  let activeBan: any | null = null;
  if (sess) {
    activeBan = await prisma.commentBan.findFirst({
      where: {
        userId: sess.uid,
        until: { gt: now },
      },
      orderBy: { until: "desc" },
    });
  } else if (ip) {
    activeBan = await prisma.commentBan.findFirst({
      where: {
        ip,
        until: { gt: now },
      },
      orderBy: { until: "desc" },
    });
  }
  if (activeBan) {
    const until = activeBan.until.toISOString();
    const reason = activeBan.reason || "";
    return NextResponse.json(
      {
        error: "comment_banned",
        until,
        reason,
        // message 字段保留给旧前端使用，前端会在收集 until/reason 时自行本地化显示
        message: "评论权限已被暂时关闭",
      },
      { status: 403 },
    );
  }

  // 访客：按 IP 频率限制 + 每日条数限制（每日最多 5 条；间隔至少 10 秒）
  if (!sess && ip) {
    const today = new Date(nowTs).toISOString().slice(0, 10);

    let rec = await prisma.rateLimit.findUnique({
      where: {
        ip_date: {
          ip,
          date: today,
        },
      },
    });

    if (!rec) {
      rec = await prisma.rateLimit.create({
        data: {
          ip,
          date: today,
          count: 0,
          lastAt: null,
        },
      });
    }

    const lastAt = rec.lastAt
      ? rec.lastAt.getTime()
      : 0;
    const gapOk =
      !lastAt || nowTs - lastAt >= 10_000;
    if (!gapOk) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "评论上传频率过高，请稍后再试哦~",
        },
        { status: 429 },
      );
    }

    if (rec.count >= 5) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "访客每天最多评论 5 条",
        },
        { status: 429 },
      );
    }

    await prisma.rateLimit.update({
      where: { id: rec.id },
      data: {
        count: rec.count + 1,
        lastAt: now,
      },
    });
  }

  // 登录用户：按用户频率限制（10 秒）
  if (sess) {
    const u = await prisma.user.findUnique({
      where: { id: sess.uid },
      select: { id: true, lastCommentAt: true },
    });
    if (u?.lastCommentAt) {
      const last = u.lastCommentAt.getTime();
      if (nowTs - last < 10_000) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "评论上传频率过高，请稍后再试哦~",
          },
          { status: 429 },
        );
      }
    }
    await prisma.user.update({
      where: { id: sess.uid },
      data: { lastCommentAt: now },
    });
  }

  // 访客昵称长度校验
  let guestName: string | undefined = undefined;
  if (!sess) {
    const rawName = String(
      body.guestName || "",
    ).trim();
    if (rawName) {
      const chinese =
        rawName.match(/[\u4e00-\u9fff]/g)
          ?.length || 0;
      const english =
        rawName.match(/[A-Za-z0-9]/g)?.length ||
        0;
      const minOk =
        english >= 3 || chinese >= 2;
      const maxOk =
        english <= 20 && chinese <= 15;
      if (!minOk || !maxOk) {
        return NextResponse.json(
          { error: "invalid nickname length" },
          { status: 400 },
        );
      }
      guestName = rawName;
    }
  }

  // 创建评论
  const created = await prisma.comment.create({
    data: {
      content,
      createdAt: now,
      postId: post.id,
      userId: sess?.uid ?? null,
      guestName:
        guestName ?? (!sess ? "匿名" : null),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
          signature: true,
          xp: true,
        },
      },
    },
  });

  if (sess?.uid) {
    try {
      await awardXpDb(sess.uid, 40);
    } catch {
      // 忽略经验更新错误，避免影响评论主流程
    }
  }

  const u = created.user;
  const level =
    u && typeof (u as any).xp === "number"
      ? (Store as any).getLevelFromXp(
          (u as any).xp,
        )
      : undefined;
  const displayName = created.userId
    ? u?.name || `用户#${created.userId}`
    : created.guestName
      ? String(created.guestName)
      : "访客";

  const c = {
    id: created.id,
    postSlug: slug,
    content: created.content,
    createdAt: created.createdAt.toISOString(),
    userId: created.userId ?? undefined,
    guestName: created.guestName ?? undefined,
    displayName,
    user: u
      ? {
          id: u.id,
          name: u.name,
          role: u.role,
          avatar: u.avatar,
          signature: u.signature,
          level,
        }
      : undefined,
  };

  return NextResponse.json({ comment: c });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // slug 仅用于路径结构，与删除权限无关
  await params;
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const idStr = searchParams.get("id");
  const id = idStr ? Number(idStr) : NaN;
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { error: "invalid id" },
      { status: 400 },
    );
  }

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
    },
  });
  if (!comment) {
    // 与旧实现保持兼容：返回 403 而不是 404
    return NextResponse.json(
      { error: "forbidden or not found" },
      { status: 403 },
    );
  }

  const isAdmin = sess.role === "ADMIN";
  if (!isAdmin && comment.userId !== sess.uid) {
    return NextResponse.json(
      { error: "forbidden or not found" },
      { status: 403 },
    );
  }

  await prisma.comment.delete({
    where: { id: comment.id },
  });

  return NextResponse.json({ ok: true });
}
