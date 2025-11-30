import { prisma } from "./prisma";

type StatsState = {
  statsDate: string;
  postsToday: number;
  xpToday: number;
  xp: number;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStats(
  statsDate: string | null | undefined,
  postsToday: number | null | undefined,
  xpToday: number | null | undefined,
  xp: number | null | undefined,
): StatsState {
  const today = todayISO();
  let d = statsDate || "";
  let p = postsToday ?? 0;
  let xpt = xpToday ?? 0;
  const x = xp ?? 0;
  if (d !== today) {
    d = today;
    p = 0;
    xpt = 0;
  }
  return { statsDate: d, postsToday: p, xpToday: xpt, xp: x };
}

/**
 * 发文频率限制：基于 Prisma.User 的 postsToday / statsDate。
 * - 管理员账户不受限制；
 * - 普通用户每天最多 50 篇。
 */
export async function canPostTodayDb(
  userId: number,
  isAdmin: boolean,
): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      statsDate: true,
      postsToday: true,
      xpToday: true,
      xp: true,
    },
  });
  if (!u) return false;
  if (isAdmin || u.role === "ADMIN") return true;

  const s = normalizeStats(
    u.statsDate,
    u.postsToday,
    u.xpToday,
    u.xp,
  );
  if (s.postsToday >= 50) {
    // 仅在跨天时同步重置 statsDate/xpToday，避免旧数据一直停留在昨天
    if (u.statsDate !== s.statsDate) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          statsDate: s.statsDate,
          postsToday: s.postsToday,
          xpToday: s.xpToday,
        },
      });
    }
    return false;
  }

  s.postsToday += 1;
  await prisma.user.update({
    where: { id: userId },
    data: {
      statsDate: s.statsDate,
      postsToday: s.postsToday,
      // xpToday/xp 不在这里修改
    },
  });
  return true;
}

/**
 * 经验值发放：基于 Prisma.User 的 xp / xpToday / statsDate。
 * - ADMIN / GUEST 不获得 XP；
 * - 普通用户每天最多 2500 XP。
 */
export async function awardXpDb(
  userId: number,
  amount: number,
): Promise<{ added: number; xpToday: number; xp: number }> {
  if (amount <= 0) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, xpToday: true },
    });
    return {
      added: 0,
      xpToday: u?.xpToday ?? 0,
      xp: u?.xp ?? 0,
    };
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      statsDate: true,
      postsToday: true,
      xpToday: true,
      xp: true,
    },
  });
  if (!u) {
    return { added: 0, xpToday: 0, xp: 0 };
  }
  if (u.role === "ADMIN" || u.role === "GUEST") {
    return {
      added: 0,
      xpToday: u.xpToday ?? 0,
      xp: u.xp ?? 0,
    };
  }

  const s = normalizeStats(
    u.statsDate,
    u.postsToday,
    u.xpToday,
    u.xp,
  );

  const remain = Math.max(0, 2500 - s.xpToday);
  const add = Math.min(remain, amount);
  if (add <= 0) {
    // 同样只在跨天时同步 statsDate 重置
    if (u.statsDate !== s.statsDate) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          statsDate: s.statsDate,
          postsToday: s.postsToday,
          xpToday: s.xpToday,
        },
      });
    }
    return {
      added: 0,
      xpToday: s.xpToday,
      xp: s.xp,
    };
  }

  s.xpToday += add;
  s.xp += add;

  await prisma.user.update({
    where: { id: userId },
    data: {
      statsDate: s.statsDate,
      postsToday: s.postsToday,
      xpToday: s.xpToday,
      xp: s.xp,
    },
  });

  return {
    added: add,
    xpToday: s.xpToday,
    xp: s.xp,
  };
}

