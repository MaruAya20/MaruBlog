import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { SiteSettings } from "@/lib/store";
import {
  getSiteSettingsDb,
  saveSiteSettingsDb,
} from "@/lib/siteSettingsDb";
import {
  getAdminElevation,
  addAdminLogDb,
} from "@/lib/adminGuard";

const forbidden = NextResponse.json({ error: "forbidden" }, { status: 403 });

async function ensureAdmin() {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") return null;
  return sess;
}

// 读取站点设置（仅管理员，且需要后台安全验证）
export async function GET(_req: NextRequest) {
  const sess = await ensureAdmin();
  if (!sess) return forbidden;

  const st = await getAdminElevation(sess.uid);
  if (!st.elevated) {
    return NextResponse.json(
      { error: "elevation_required" },
      { status: 403 },
    );
  }

  const settings = await getSiteSettingsDb();
  return NextResponse.json({ settings });
}

// 更新站点设置（仅管理员，且需要后台安全验证）
export async function POST(req: NextRequest) {
  const sess = await ensureAdmin();
  if (!sess) return forbidden;

  const st = await getAdminElevation(sess.uid);
  if (!st.elevated) {
    return NextResponse.json(
      { error: "elevation_required" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Partial<SiteSettings>;

  const current = await getSiteSettingsDb();
  const next: SiteSettings = { ...current };

  if (typeof body.title === "string") {
    const v = body.title.trim();
    if (!v) {
      return NextResponse.json(
        { error: "invalid_title", message: "站点标题不能为空" },
        { status: 400 },
      );
    }
    next.title = v.slice(0, 60);
  }

  if (typeof body.subtitle === "string") {
    next.subtitle = body.subtitle.trim().slice(0, 80);
  }

  if (typeof body.seoDescription === "string") {
    next.seoDescription = body.seoDescription.trim().slice(0, 200);
  }

  if (typeof body.announcement === "string") {
    next.announcement = body.announcement.trim().slice(0, 500);
  }

  if (typeof body.allowGuestComment === "boolean") {
    next.allowGuestComment = body.allowGuestComment;
  }

  if (typeof body.allowRegistration === "boolean") {
    next.allowRegistration = body.allowRegistration;
  }

  const saved = await saveSiteSettingsDb(next);

  // 记一条后台操作日志（可选）
  await addAdminLogDb({
    adminId: sess.uid,
    action: "update_site_settings",
    targetType: "settings",
    detail: JSON.stringify({
      title: saved.title,
      allowGuestComment: saved.allowGuestComment,
      allowRegistration: saved.allowRegistration,
    }),
  });

  return NextResponse.json({ ok: true, settings: saved });
}
