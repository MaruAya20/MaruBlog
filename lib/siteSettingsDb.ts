import { prisma } from "./prisma";
import type { SiteSettings as StoreSiteSettings } from "./store";

export type SiteSettingsData = StoreSiteSettings;

const DEFAULT_SETTINGS: SiteSettingsData = {
  title: "MaruBlog",
  subtitle: "",
  seoDescription: "",
  announcement: "",
  allowGuestComment: true,
  allowRegistration: true,
};

function mapRowToSettings(row: {
  title: string;
  subtitle: string | null;
  seoDescription: string | null;
  announcement: string | null;
  allowGuestComment: boolean;
  allowRegistration: boolean;
}): SiteSettingsData {
  return {
    title: row.title,
    subtitle: row.subtitle || "",
    seoDescription: row.seoDescription || "",
    announcement: row.announcement || "",
    allowGuestComment: row.allowGuestComment,
    allowRegistration: row.allowRegistration,
  };
}

// 从数据库读取站点设置（id 固定为 1），不存在时返回默认值
export async function getSiteSettingsDb(): Promise<SiteSettingsData> {
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: 1 },
    });
    if (!row) return DEFAULT_SETTINGS;
    return mapRowToSettings(row);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// 将站点设置写入数据库（upsert id=1），返回最新的设置
export async function saveSiteSettingsDb(
  next: SiteSettingsData,
): Promise<SiteSettingsData> {
  const row = await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {
      title: next.title,
      subtitle: next.subtitle || null,
      seoDescription: next.seoDescription || null,
      announcement: next.announcement || null,
      allowGuestComment: next.allowGuestComment,
      allowRegistration: next.allowRegistration,
    },
    create: {
      // id 在 schema 中默认就是 1，这里显式指定，确保只有一行
      id: 1,
      title: next.title || DEFAULT_SETTINGS.title,
      subtitle: next.subtitle || null,
      seoDescription: next.seoDescription || null,
      announcement: next.announcement || null,
      allowGuestComment: next.allowGuestComment,
      allowRegistration: next.allowRegistration,
    },
  });
  return mapRowToSettings(row);
}

