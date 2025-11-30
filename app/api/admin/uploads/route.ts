import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminElevation } from "@/lib/adminGuard";

export async function GET(req: NextRequest) {
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
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as any;
  const kind = searchParams.get("kind") as any;

  const where: any = {};
  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }
  if (kind) {
    where.kind = kind.toUpperCase();
  }

  const uploads = await prisma.upload.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // 保持与旧 Store.listUploads 返回结构兼容
  const list = uploads.map((u) => ({
    id: u.id,
    userId: u.userId ?? undefined,
    kind: u.kind.toLowerCase(),
    filename: u.filename,
    url: u.url,
    status: u.status.toLowerCase(),
    createdAt: u.createdAt.toISOString(),
    originalName: u.originalName || "",
    mime: u.mime,
    size: u.size,
  }));

  return NextResponse.json({ uploads: list });
}
