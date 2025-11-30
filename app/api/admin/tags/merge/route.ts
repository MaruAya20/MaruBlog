import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminElevation } from "@/lib/adminGuard";

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
    sourceId?: number;
    targetId?: number;
  };
  const sourceId = Number(body.sourceId);
  const targetId = Number(body.targetId);
  if (
    !Number.isFinite(sourceId) ||
    !Number.isFinite(targetId) ||
    sourceId <= 0 ||
    targetId <= 0 ||
    sourceId === targetId
  ) {
    return NextResponse.json(
      { error: "invalid_ids" },
      { status: 400 },
    );
  }

  const source = await prisma.tagDef.findUnique({
    where: { id: sourceId },
  });
  const target = await prisma.tagDef.findUnique({
    where: { id: targetId },
  });
  if (!source || !target) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404 },
    );
  }

  // 将所有文章的 source.name 替换为 target.name，并去重
  const posts = await prisma.post.findMany({
    where: { tags: { has: source.name } },
    select: { id: true, tags: true },
  });
  for (const p of posts) {
    const tags = (p.tags || []) as string[];
    let changed = false;
    const next: string[] = [];
    for (const t of tags) {
      let val = t;
      if (t === source.name) {
        val = target.name;
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

  // 删除源标签定义
  await prisma.tagDef.delete({
    where: { id: sourceId },
  });

  return NextResponse.json({ ok: true });
}
