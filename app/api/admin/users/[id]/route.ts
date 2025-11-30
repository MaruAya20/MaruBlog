import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";
import { deleteUserDeepDb } from "@/lib/userDeleteDb";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
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

  const { id } = await ctx.params;
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { error: "invalid_user" },
      { status: 400 },
    );
  }

  const result = await deleteUserDeepDb(userId);
  if (!result.ok) {
    if (result.reason === "cannot_delete_admin") {
      return NextResponse.json(
        { error: "cannot_delete_admin" },
        { status: 400 },
      );
    }
    if (result.reason === "not_found") {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "delete_failed" },
      { status: 400 },
    );
  }

  await addAdminLogDb({
    adminId: sess.uid,
    action: "user_delete",
    targetType: "user",
    targetId: userId,
    detail: `delete user ${userId}`,
  });

  return NextResponse.json({ ok: true });
}
