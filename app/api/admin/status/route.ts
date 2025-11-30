import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminElevation } from "@/lib/adminGuard";

// 查询当前管理员的后台提升状态，用于前端展示
export async function GET() {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") {
    return NextResponse.json({ elevated: false, until: null });
  }
  const st = await getAdminElevation(sess.uid);
  return NextResponse.json(st);
}
