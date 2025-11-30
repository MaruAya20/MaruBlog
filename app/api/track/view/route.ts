import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slugParam = searchParams.get("slug");
  const routeParam = searchParams.get("route");

  const slug = slugParam || undefined;
  const route = routeParam || (slug ? `/post/${slug}` : "/");

  const sess = await getSession();

  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  const ipRaw = forwardedFor.split(",")[0].trim() || realIp || undefined;

  try {
    // 简单去重：同一用户/IP 在极短时间内（默认 3 秒）对同一路由的重复上报视为一次
    const now = Date.now();
    const where: any = { route };
    if (sess?.uid) {
      where.userId = sess.uid;
    } else if (ipRaw) {
      where.ip = ipRaw;
    }

    const latest = await prisma.pageView.findFirst({
      where,
      orderBy: { at: "desc" },
    });

    if (latest) {
      const delta = now - latest.at.getTime();
      // 3 秒内的重复记录直接忽略，避免 React 严格模式等导致的双重上报
      if (delta >= 0 && delta < 3000) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }

    await prisma.pageView.create({
      data: {
        route,
        slug: slug || null,
        userId: sess?.uid ?? null,
        ip: ipRaw || null,
      },
    });
  } catch {
    // PV 记录失败不影响页面加载，静默忽略
  }

  return NextResponse.json({ ok: true });
}
