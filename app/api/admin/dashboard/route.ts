import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminElevation } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// 管理员仪表盘数据（PV/UV 仍暂时来自 JSON 迁移表 pageViews，其它统计来自 Prisma）
export async function GET(req: NextRequest) {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") return forbidden();

  const st = await getAdminElevation(sess.uid);
  if (!st.elevated) {
    return NextResponse.json(
      { error: "elevation_required" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const daysRaw = searchParams.get("days");
  const days = Math.min(
    30,
    Math.max(1, daysRaw ? Number(daysRaw) || 7 : 7),
  );

  const now = Date.now();
  const fromTs = now - days * 24 * 60 * 60 * 1000;

  // PV/UV 统计仍使用 pageViews（来自 JSON 迁移数据），简化实现：只读 PostgreSQL PageView 表
  const viewsInRange = await prisma.pageView.findMany({
    where: {
      at: {
        gte: new Date(fromTs),
        lte: new Date(now),
      },
    },
  });

  const pv = viewsInRange.length;

  const uvSet = new Set<string>();
  for (const v of viewsInRange) {
    if (v.userId) {
      uvSet.add(`u:${v.userId}`);
    } else if (v.ip) {
      uvSet.add(`g:${v.ip}`);
    } else {
      uvSet.add("guest");
    }
  }
  const uv = uvSet.size;

  // 文章级别统计：从 Prisma Post / Like / Favorite / Comment 中聚合
  const posts = await prisma.post.findMany({
    select: {
      slug: true,
      title: true,
    },
  });

  const [likes, favorites, comments] = await Promise.all([
    prisma.like.findMany({
      select: { postId: true, post: { select: { slug: true } } },
    }),
    prisma.favorite.findMany({
      select: { postId: true, post: { select: { slug: true } } },
    }),
    prisma.comment.findMany({
      select: { postId: true, post: { select: { slug: true } } },
    }),
  ]);

  const postStats: any[] = [];
  for (const p of posts) {
    const slug = p.slug;
    const vList = viewsInRange.filter((v) => v.slug === slug);
    const pvPost = vList.length;
    const uvPostSet = new Set<string>();
    for (const v of vList) {
      if (v.userId) {
        uvPostSet.add(`u:${v.userId}`);
      } else if (v.ip) {
        uvPostSet.add(`g:${v.ip}`);
      } else {
        uvPostSet.add("guest");
      }
    }
    const uvPost = uvPostSet.size;

    const likeCount = likes.filter((l) => l.post?.slug === slug).length;
    const favCount = favorites.filter((f) => f.post?.slug === slug).length;
    const commentCount = comments.filter((c) => c.post?.slug === slug).length;

    const pvBase = pvPost || 1;
    const favRate = favCount / pvBase;
    const commentRate = commentCount / pvBase;

    postStats.push({
      slug,
      title: p.title,
      pv: pvPost,
      uv: uvPost,
      likes: likeCount,
      favorites: favCount,
      comments: commentCount,
      favRate,
      commentRate,
    });
  }

  postStats.sort((a, b) => b.pv - a.pv);
  const topPosts = postStats.slice(0, 10);

  const totalFavorites = favorites.length;
  const totalComments = comments.length;
  const pvBase = pv || 1;

  const summary = {
    pv,
    uv,
    favorites: totalFavorites,
    comments: totalComments,
    favRate: totalFavorites / pvBase,
    commentRate: totalComments / pvBase,
  };

  return NextResponse.json({
    ok: true,
    days,
    summary,
    topPosts,
  });
}
