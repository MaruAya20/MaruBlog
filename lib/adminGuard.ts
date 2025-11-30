import { prisma } from "./prisma";

export type AdminElevationState = {
  elevated: boolean;
  until: string | null;
};

/**
 * 读取当前管理员的后台提升状态。
 * 如果记录不存在或已过期，则返回 elevated = false。
 */
export async function getAdminElevation(
  userId: number,
): Promise<AdminElevationState> {
  try {
    const rec = await prisma.adminSession.findFirst({
      where: { userId },
      orderBy: { until: "desc" },
    });
    if (!rec) {
      return { elevated: false, until: null };
    }
    const now = new Date();
    if (rec.until <= now) {
      // 已过期：保留 until 供界面展示，但视为未提升
      return { elevated: false, until: rec.until.toISOString() };
    }
    return { elevated: true, until: rec.until.toISOString() };
  } catch {
    // 数据库异常时，安全起见视为未提升
    return { elevated: false, until: null };
  }
}

/**
 * 设置 / 刷新管理员的后台提升窗口。
 * 返回新的过期时间（ISO 字符串）。
 */
export async function setAdminElevationDb(
  userId: number,
  minutes: number,
): Promise<string> {
  const until = new Date(Date.now() + minutes * 60_000);
  try {
    // AdminSession.userId 在 schema 中不是唯一键，不能直接用 upsert(where: { userId })
    // 否则 Prisma 会抛错，导致记录根本不会写入。
    const existing = await prisma.adminSession.findFirst({
      where: { userId },
      orderBy: { until: "desc" },
    });
    if (existing) {
      await prisma.adminSession.update({
        where: { id: existing.id },
        data: { until },
      });
    } else {
      await prisma.adminSession.create({
        data: { userId, until },
      });
    }
  } catch {
    // 忽略持久化错误：前端仍会看到 until，但后续检查可能失败，需要重新验证
  }
  return until.toISOString();
}

export type AdminLogInput = {
  adminId: number;
  action: string;
  targetType?: string;
  targetId?: string | number;
  detail?: string;
  ip?: string;
  ua?: string;
};

/**
 * 写入一条后台操作日志到 Prisma.AdminLog。
 * 失败会被忽略，不阻塞主流程。
 */
export async function addAdminLogDb(
  entry: AdminLogInput,
): Promise<void> {
  try {
    await prisma.adminLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId:
          entry.targetId !== undefined &&
          entry.targetId !== null
            ? String(entry.targetId)
            : null,
        detail: entry.detail ?? null,
        ip: entry.ip ?? null,
        ua: entry.ua ?? null,
      },
    });
  } catch {
    // 忽略日志异常
  }
}

