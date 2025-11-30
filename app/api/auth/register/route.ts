import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/auth";
import { getSiteSettingsDb } from "@/lib/siteSettingsDb";
import { prisma } from "@/lib/prisma";

// 昵称规则：长度按英文计数，3~30 个英文字符（1 个中文按 2 个英文计）
function validateNickname(name: string): boolean {
  const str = (name || "").trim();
  if (!str) return false;
  const chinese = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (str.match(/[A-Za-z0-9]/g) || []).length;
  const total = english + chinese * 2;
  return total >= 3 && total <= 30;
}

// 注册新用户：邮箱 + 验证码 + 昵称
export async function POST(req: NextRequest) {
  const { email, code, name } = (await req
    .json()
    .catch(() => ({}))) as {
    email?: string;
    code?: string | number;
    name?: string;
  };

  if (!email || !code || !name) {
    return NextResponse.json(
      {
        error: "invalid",
        message: "邮箱、验证码和昵称均为必填",
      },
      { status: 400 },
    );
  }

  if (!validateNickname(String(name))) {
    return NextResponse.json(
      {
        error: "invalid_nickname",
        message:
          "昵称长度需 3~30 个英文字符（1 个中文按 2 个英文计）",
      },
      { status: 400 },
    );
  }

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

  // 校验验证码（10 分钟有效期）
  const entry = await prisma.loginCode.findUnique({
    where: { email },
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

  // 检查是否已有同邮箱用户
  const exists = await prisma.user.findUnique({
    where: { email },
  });
  if (exists) {
    return NextResponse.json(
      {
        error: "user_exists",
        message: "该邮箱已注册，请直接登录",
      },
      { status: 400 },
    );
  }

  const role =
    process.env.ADMIN_EMAIL &&
    email === process.env.ADMIN_EMAIL
      ? "ADMIN"
      : "AUTHOR";

  const u = await prisma.user.create({
    data: {
      email,
      name,
      role,
    },
  });

  await prisma.loginCode
    .delete({
      where: { email },
    })
    .catch(() => {
      // 忽略删除验证码失败，避免影响主流程
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

