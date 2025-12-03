import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 邮箱登录：仅允许已注册用户使用，不再自动创建账号
export async function POST(req: NextRequest) {
  const { email, code } = (await req
    .json()
    .catch(() => ({}))) as {
    email?: string;
    code?: string | number;
  };
  if (!email || !code) {
    return NextResponse.json(
      { error: "invalid" },
      { status: 400 },
    );
  }

  // 校验验证码（10 分钟有效期）
  const emailRaw = String(email).trim();
  const normalizedEmail = emailRaw.toLowerCase();

  const entry = await prisma.loginCode.findUnique({
    where: { email: normalizedEmail },
  });
  const age = entry
    ? Date.now() - entry.createdAt.getTime()
    : Infinity;
  if (
    !entry ||
    entry.code !== String(code) ||
    age > 10 * 60 * 1000
  ) {
    return NextResponse.json(
      { error: "code invalid" },
      { status: 400 },
    );
  }

  const u = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!u) {
    return NextResponse.json(
      {
        error: "no_user",
        message: "该邮箱尚未注册",
      },
      { status: 400 },
    );
  }

  // 检查是否存在登录封禁（管理员账号不会被封禁）
  if (u.role !== "ADMIN") {
    try {
      const now = new Date();
      const ban = await prisma.userBan.findFirst({
        where: {
          userId: u.id,
          OR: [
            { permanent: true },
            { until: { gt: now } },
          ],
        },
        orderBy: { until: "desc" },
      });
      if (ban) {
        return NextResponse.json(
          {
            error: "user_banned",
            until: ban.until.toISOString(),
            reason: ban.reason || "",
            permanent: !!ban.permanent,
            message: "用户权限当前被封禁",
          },
          { status: 403 },
        );
      }
    } catch {
      // 忽略封禁检查错误，避免影响登录主流程
    }
  }

  await prisma.loginCode
    .delete({
      where: { email: normalizedEmail },
    })
    .catch(() => {
      // 忽略删除验证码失败，避免影响登录
    });

  await setSession({
    uid: u.id,
    role: u.role as any,
    name: u.name ?? undefined,
    email: u.email ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: u.id,
      email: u.email ?? undefined,
      name: u.name ?? undefined,
      role: u.role,
    },
  });
}
