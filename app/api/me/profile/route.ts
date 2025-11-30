import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";

// 昵称规则：与注册时保持一致：3~30 个英文字符（1 个中文按 2 个英文计）
function validateNickname(name: string): boolean {
  const str = (name || "").trim();
  if (!str) return false;
  const chinese = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (str.match(/[A-Za-z0-9]/g) || []).length;
  const total = english + chinese * 2;
  return total >= 3 && total <= 30;
}

export async function PATCH(req: NextRequest) {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }
  if (sess.role === "GUEST") {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 },
    );
  }

  const { name, avatar, signature } =
    (await req.json().catch(() => ({}))) as {
      name?: string;
      avatar?: string;
      signature?: string;
    };

  if (name !== undefined && typeof name !== "string") {
    return NextResponse.json(
      { error: "invalid" },
      { status: 400 },
    );
  }

  if (typeof name === "string") {
    if (!validateNickname(name)) {
      return NextResponse.json(
        { error: "invalid nickname length" },
        { status: 400 },
      );
    }
  }

  const data: any = {};
  if (name !== undefined) {
    data.name = name.trim();
  }
  if (avatar !== undefined) {
    data.avatar = avatar;
  }
  if (signature !== undefined) {
    data.signature = signature;
  }

  try {
    // 先读取旧的头像 URL，便于在更新成功后清理旧资源
    const prev = await prisma.user.findUnique({
      where: { id: sess.uid },
      select: { avatar: true },
    });

    const u = await prisma.user.update({
      where: { id: sess.uid },
      data,
    });

    // 如头像发生变化，且旧头像是本站 uploads 资源，则删除旧文件和上传记录
    if (
      avatar !== undefined &&
      prev?.avatar &&
      prev.avatar !== avatar &&
      prev.avatar.startsWith("/uploads/")
    ) {
      try {
        // 删除 Upload 记录（仅限该用户、头像类型、匹配 URL）
        await prisma.upload.deleteMany({
          where: {
            userId: sess.uid,
            kind: "AVATAR",
            url: prev.avatar,
          },
        });

        // 删除物理文件
        const fp = path.join(
          process.cwd(),
          "public",
          prev.avatar.replace(/^\//, ""),
        );
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
        }
      } catch {
        // 忽略清理错误，避免影响用户保存操作
      }
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: u.id,
        name: u.name ?? undefined,
        email: u.email ?? undefined,
        role: u.role,
        avatar: u.avatar ?? undefined,
        signature: u.signature ?? undefined,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "not found" },
      { status: 404 },
    );
  }
}
