import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";
import fs from "node:fs";
import path from "node:path";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "approve" | "reject";
  };
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { error: "invalid action" },
      { status: 400 },
    );
  }

  const uploadId = Number(id);
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json(
      { error: "invalid id" },
      { status: 400 },
    );
  }

  if (body.action === "approve") {
    const rec = await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "APPROVED" },
    });

    await addAdminLogDb({
      adminId: sess.uid,
      action: "upload_approve",
      targetType: "upload",
      targetId: uploadId,
      detail: rec.url,
    });

    return NextResponse.json({
      ok: true,
      upload: {
        id: rec.id,
        userId: rec.userId ?? undefined,
        kind: rec.kind.toLowerCase(),
        filename: rec.filename,
        url: rec.url,
        status: rec.status.toLowerCase(),
        createdAt: rec.createdAt.toISOString(),
        originalName: rec.originalName || "",
        mime: rec.mime,
        size: rec.size,
      },
    });
  }

  // 审核拒绝：删除文件与 Upload 记录
  const rec = await prisma.upload.findUnique({
    where: { id: uploadId },
  });
  if (!rec) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const pubDir = path.join(process.cwd(), "public");
    const filePath = path.join(
      pubDir,
      String(rec.url || "").replace(/^\//, ""),
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // 忽略文件删除错误，避免影响逻辑
  }

  await prisma.upload.delete({
    where: { id: rec.id },
  });

  await addAdminLogDb({
    adminId: sess.uid,
    action: "upload_reject",
    targetType: "upload",
    targetId: uploadId,
    detail: rec.url,
  });

  return NextResponse.json({ ok: true, removed: true });
}
