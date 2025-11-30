import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth";
import { Store } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { deleteUserDeepDb } from "@/lib/userDeleteDb";

// 当前登录用户信息
export async function GET() {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ user: null });

  // 角色修正：确保 MaruAya20 拥有管理员权限
  const forceAdmin = sess.name === "MaruAya20";

  try {
    const u = await prisma.user.findUnique({
      where: { id: sess.uid },
    });
    if (u) {
      const xp = u.xp ?? 0;
      const level = Store.getLevelFromXp(xp);
      const xpToday = u.xpToday ?? 0;
      return NextResponse.json({
        user: {
          id: u.id,
          email: u.email ?? undefined,
          name: u.name ?? undefined,
          role: (forceAdmin ? "ADMIN" : u.role) as any,
          avatar: u.avatar ?? undefined,
          signature: u.signature ?? undefined,
          xp,
          level,
          xpToday,
        },
      });
    }
  } catch {
    // ignore, fall back to session-only user
  }

  // 当 DB 读取异常或用户未持久化时，用会话信息构造用户，并按需提升为 ADMIN
  return NextResponse.json({
    user: {
      id: sess.uid,
      email: sess.email,
      name: sess.name,
      role: forceAdmin ? "ADMIN" : sess.role,
    },
  });
}

// 删除当前登录用户及其数据（管理员账号不会被删除）
export async function DELETE() {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const result = await deleteUserDeepDb(sess.uid);
  if (!result.ok) {
    if (result.reason === "cannot_delete_admin") {
      return NextResponse.json(
        { error: "cannot_delete_admin" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "delete_failed" },
      { status: 400 },
    );
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}

