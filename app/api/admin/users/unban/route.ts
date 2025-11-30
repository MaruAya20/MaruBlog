import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";

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
    userId?: number;
  };
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { error: "invalid_user" },
      { status: 400 },
    );
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!u) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 },
    );
  }

  await prisma.userBan.deleteMany({
    where: { userId },
  });

  await addAdminLogDb({
    adminId: sess.uid,
    action: "user_unban",
    targetType: "user",
    targetId: userId,
  });

  return NextResponse.json({ ok: true });
}
