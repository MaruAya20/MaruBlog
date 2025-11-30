import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTagStyle } from "@/lib/tagStyle";
import { getAdminElevation } from "@/lib/adminGuard";

function requireAdminSession() {
  return getSession();
}

// 列表标签：名称、颜色、隐藏状态、文章数量
export async function GET(_req: NextRequest) {
  const sess = await requireAdminSession();
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

  // 读取标签定义
  let defs = await prisma.tagDef.findMany();

  // 补全缺失颜色（兼容历史数据）
  for (const t of defs) {
    if (!t.color && !t.bg && !t.border) {
      const sty = getTagStyle(t.name);
      await prisma.tagDef.update({
        where: { id: t.id },
        data: {
          color: sty.color,
          bg: sty.bg,
          border: sty.border,
        },
      });
    }
  }
  defs = await prisma.tagDef.findMany();

  // 统计文章数量（不区分草稿/发布，简单计数）
  const posts = await prisma.post.findMany({
    select: { tags: true },
  });
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const tags = (p.tags || []) as string[];
    for (const t of tags) {
      const key = String(t || "");
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
  }

  const tags = defs.map((t) => {
    const sty = getTagStyle(t.name);
    return {
      id: t.id,
      name: t.name,
      color: t.color || sty.color,
      bg: t.bg || sty.bg,
      border: t.border || sty.border,
      hidden: !!t.hidden,
      count: counts[t.name] || 0,
    };
  });

  // 简单按名称排序
  tags.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return NextResponse.json({ tags });
}

// 新增标签：名称 + 颜色
export async function POST(req: NextRequest) {
  const sess = await requireAdminSession();
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
    name?: string;
    color?: string;
    bg?: string;
    border?: string;
  };
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "invalid_name" },
      { status: 400 },
    );
  }

  const existing = await prisma.tagDef.findUnique({
    where: { name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "duplicate", message: "已存在同名标签" },
      { status: 400 },
    );
  }

  const sty = getTagStyle(name);
  const rec = await prisma.tagDef.create({
    data: {
      name,
      color: body.color || sty.color,
      bg: body.bg || sty.bg,
      border: body.border || sty.border,
      hidden: false,
    },
  });

  return NextResponse.json({ ok: true, tag: rec });
}
