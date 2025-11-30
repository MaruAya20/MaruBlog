import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";

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
    userId?: number;
    minutes?: number | null;
    reason?: string;
  };
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { error: "invalid_user" },
      { status: 400 },
    );
  }

  // minutes 为空表示永久封禁（null 表示按分钟计算）
  const minutesRaw = body.minutes;
  let minutes: number | null;
  if (minutesRaw === undefined || minutesRaw === null) {
    minutes = null;
  } else {
    const v = Number(minutesRaw);
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json(
        { error: "invalid_minutes" },
        { status: 400 },
      );
    }
    minutes = v;
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!u) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 },
    );
  }
  if (u.role === "ADMIN") {
    return NextResponse.json(
      { error: "cannot_ban_admin" },
      { status: 400 },
    );
  }

  // 永久封禁用一个极远的未来时间表示，方便复用统一逻辑
  const permanent = minutes === null;
  const untilDate = new Date(
    permanent
      ? Date.now() + 100 * 365 * 24 * 60 * 60_000
      : Date.now() + (minutes as number) * 60_000,
  );

  const rec = await prisma.userBan.create({
    data: {
      userId,
      until: untilDate,
      reason: body.reason || null,
      permanent,
    },
  });

  // 记录后台日志
  await addAdminLogDb({
    adminId: sess.uid,
    action: "user_ban",
    targetType: "user",
    targetId: userId,
    detail: `until=${rec.until.toISOString()}; permanent=${
      rec.permanent ? "1" : "0"
    }; reason=${body.reason || ""}`,
  });

  // 最简单的“重置已登录状态”：如果当前请求就是被封禁用户，则清除会话
  if (sess.uid === userId) {
    await clearSession();
  }

  return NextResponse.json({
    ok: true,
    ban: {
      userId,
      until: rec.until.toISOString(),
      reason: rec.reason || "",
      permanent: rec.permanent,
    },
  });
}
