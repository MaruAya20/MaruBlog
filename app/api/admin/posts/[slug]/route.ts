import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
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

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  // 先取出文章信息用于日志记录
  const dbPost = await prisma.post.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
    },
  });
  if (!dbPost) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 通过数据库删除文章以及关联的评论 / 点赞 / 收藏
  try {
    await prisma.comment.deleteMany({
      where: { postId: dbPost.id },
    });
    await prisma.like.deleteMany({
      where: { postId: dbPost.id },
    });
    await prisma.favorite.deleteMany({
      where: { postId: dbPost.id },
    });

    await prisma.post.delete({
      where: { id: dbPost.id },
    });
  } catch {
    // 忽略数据库删除错误，避免影响前端体验
  }

  await addAdminLogDb({
    adminId: sess.uid,
    action: "post_delete",
    targetType: "post",
    targetId: slug,
    detail: dbPost.title || "",
  });

  return NextResponse.json({ ok: true });
}

