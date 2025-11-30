import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminElevation } from "@/lib/adminGuard";

const forbidden = NextResponse.json(
  { error: "forbidden" },
  { status: 403 },
);

async function ensureAdmin() {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") return null;
  return sess;
}

// 更新单个标签：重命名 / 颜色 / 隐藏
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const sess = await ensureAdmin();
  if (!sess) return forbidden;
  const { id } = await ctx.params;
  const tagId = Number(id);
  if (!Number.isFinite(tagId) || tagId <= 0) {
    return NextResponse.json(
      { error: "invalid_id" },
      { status: 400 },
    );
  }

  const st = await getAdminElevation(sess.uid);
  if (!st.elevated) {
    return NextResponse.json(
      { error: "elevation_required" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string;
    bg?: string;
    border?: string;
    hidden?: boolean;
  };

  const tag = await prisma.tagDef.findUnique({
    where: { id: tagId },
  });
  if (!tag) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  const data: any = {};

  // 重命名标签时，级联到所有文章的 tags 数组
  const newNameRaw = body.name;
  if (typeof newNameRaw === "string") {
    const newName = newNameRaw.trim();
    if (!newName) {
      return NextResponse.json(
        { error: "invalid_name" },
        { status: 400 },
      );
    }
    if (newName !== tag.name) {
      const dup = await prisma.tagDef.findUnique({
        where: { name: newName },
      });
      if (dup && dup.id !== tagId) {
        return NextResponse.json(
          { error: "duplicate", message: "已存在同名标签" },
          { status: 400 },
        );
      }
      const oldName = tag.name;
      data.name = newName;

      const posts = await prisma.post.findMany({
        where: { tags: { has: oldName } },
        select: { id: true, tags: true },
      });
      for (const p of posts) {
        const tags = (p.tags || []) as string[];
        let changed = false;
        const next: string[] = [];
        for (const t of tags) {
          let val = t;
          if (t === oldName) {
            val = newName;
            changed = true;
          }
          if (!next.includes(val)) next.push(val);
        }
        if (changed) {
          await prisma.post.update({
            where: { id: p.id },
            data: { tags: next },
          });
        }
      }
    }
  }

  if (body.color !== undefined) {
    data.color = body.color || "";
  }
  if (body.bg !== undefined) {
    data.bg = body.bg || "";
  }
  if (body.border !== undefined) {
    data.border = body.border || "";
  }
  if (body.hidden !== undefined) {
    data.hidden = !!body.hidden;
  }

  const updated = await prisma.tagDef.update({
    where: { id: tagId },
    data,
  });

  return NextResponse.json({ ok: true, tag: updated });
}

// 删除标签：从所有文章 tags 中移除该标签，并移除定义
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const sess = await ensureAdmin();
  if (!sess) return forbidden;
  const { id } = await ctx.params;
  const tagId = Number(id);
  if (!Number.isFinite(tagId) || tagId <= 0) {
    return NextResponse.json(
      { error: "invalid_id" },
      { status: 400 },
    );
  }

  const st = await getAdminElevation(sess.uid);
  if (!st.elevated) {
    return NextResponse.json(
      { error: "elevation_required" },
      { status: 403 },
    );
  }

  const tag = await prisma.tagDef.findUnique({
    where: { id: tagId },
  });
  if (!tag) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  const name = tag.name;

  // 从所有文章中移除该标签
  const posts = await prisma.post.findMany({
    where: { tags: { has: name } },
    select: { id: true, tags: true },
  });
  for (const p of posts) {
    const tags = (p.tags || []) as string[];
    const next = tags.filter((t) => t !== name);
    if (next.length !== tags.length) {
      await prisma.post.update({
        where: { id: p.id },
        data: { tags: next },
      });
    }
  }

  await prisma.tagDef.delete({
    where: { id: tagId },
  });

  return NextResponse.json({ ok: true });
}
