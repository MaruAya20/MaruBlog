import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { setAdminElevationDb } from "@/lib/adminGuard";

// 管理操作码验证：提升当前管理员的后台操作权限（短时有效）
export async function POST(req: NextRequest) {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 附加一层保护：仅允许 .env 中指定的 ADMIN_EMAIL 账号进行后台提升
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (adminEmail && sess.email && sess.email !== adminEmail) {
    return NextResponse.json(
      { error: "not_primary_admin" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
  };
  const raw = (body.code || "").trim();
  if (!raw) {
    return NextResponse.json(
      { error: "missing_code" },
      { status: 400 },
    );
  }

  // 预留两个环境变量名，便于你在 .env 中自定义：
  // ADMIN_OP_CODE / ADMIN_CODE，任意一个即可
  const envCode =
    process.env.ADMIN_OP_CODE?.trim() ||
    process.env.ADMIN_CODE?.trim();

  // 开发环境兜底：如果未配置环境变量，则使用固定默认码并打印提示
  const expected = envCode || "123456";
  if (!envCode) {
    console.warn(
      "[admin] ADMIN_OP_CODE/ADMIN_CODE 未配置，使用默认操作码 123456（仅适合本地开发）",
    );
  }

  if (raw !== expected) {
    return NextResponse.json(
      { error: "invalid_code" },
      { status: 400 },
    );
  }

  // 通过验证：记录 30 分钟的提升状态
  const until = await setAdminElevationDb(sess.uid, 30);
  return NextResponse.json({ ok: true, until });
}

