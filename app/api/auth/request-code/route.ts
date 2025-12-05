import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsDb } from "@/lib/siteSettingsDb";
import { sendLoginCodeEmail } from "@/lib/mail";
import {
  isValidEmailFormat,
  isEmailDomainReachable,
} from "@/lib/emailValidate";

export async function POST(req: NextRequest) {
  const { email, mode } = (await req.json().catch(() => ({}))) as {
    email?: string;
    mode?: "login" | "register";
  };

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "invalid_email" },
      { status: 400 },
    );
  }

  const trimmedEmail = email.trim();
  const normalizedEmail = trimmedEmail.toLowerCase();

  // 1) 基本格式校验
  if (!isValidEmailFormat(normalizedEmail)) {
    return NextResponse.json(
      {
        error: "invalid_email_format",
        message: "邮箱格式不正确",
      },
      { status: 400 },
    );
  }

  // 2) 域名可用性校验：检查 MX / A 记录，避免明显不可用的邮箱域名
  const domainOk = await isEmailDomainReachable(normalizedEmail);
  if (!domainOk) {
    return NextResponse.json(
      {
        error: "invalid_email_domain",
        message: "该邮箱域名不可用，请检查后再试",
      },
      { status: 400 },
    );
  }

  const kind: "login" | "register" =
    mode === "register" ? "register" : "login";

  // 先查用户（用于登录或检测重复注册）
  let user:
    | {
        id: number;
        email: string | null;
        role: string;
      }
    | null = null;

  try {
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, role: true },
    });
  } catch {
    user = null;
  }

  if (kind === "login") {
    // 登录：必须已有用户
    if (!user) {
      return NextResponse.json(
        { error: "no_user", message: "该邮箱尚未注册" },
        { status: 400 },
      );
    }

    // 非管理员时检查用户封禁
    if (user.role !== "ADMIN") {
      try {
        const now = new Date();
        const ban = await prisma.userBan.findFirst({
          where: {
            userId: user.id,
            OR: [{ permanent: true }, { until: { gt: now } }],
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
        // 忽略封禁检查错误
      }
    }
  } else {
    // 注册：站点必须允许注册，且邮箱未被占用
    const settings = await getSiteSettingsDb();
    if (!settings.allowRegistration) {
      return NextResponse.json(
        {
          error: "registration_closed",
          message: "站点当前已关闭注册，请稍后再试",
        },
        { status: 403 },
      );
    }

    if (user) {
      return NextResponse.json(
        {
          error: "user_exists",
          message: "该邮箱已注册，请直接登录",
        },
        { status: 400 },
      );
    }
  }

  // 发送验证码频率限制：1 分钟内仅允许发送一次
  try {
    const entry = await prisma.loginCode.findUnique({
      where: { email: normalizedEmail },
    });
    if (entry) {
      const ageMs = Date.now() - entry.createdAt.getTime();
      if (ageMs < 60_000) {
        const retryAfter = Math.ceil((60_000 - ageMs) / 1000);
        return NextResponse.json(
          {
            error: "too_frequent",
            retryAfter,
            message: `获取验证码太频繁，请在 ${retryAfter} 秒后再试`,
          },
          { status: 429 },
        );
      }
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000),
    );

    await prisma.loginCode.upsert({
      where: { email: normalizedEmail },
      update: { code, createdAt: new Date() },
      create: { email: normalizedEmail, code },
    });

    // 实际发送邮件时不区分大小写，这里使用规范化后的地址
    await sendLoginCodeEmail(normalizedEmail, code, kind);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/request-code] error:", err);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 },
    );
  }
}
