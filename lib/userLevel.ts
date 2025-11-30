import type { Role } from "@/lib/store";

// 与 levels 页面保持一致的等级名称与颜色
export const LEVEL_NAMES = [
  "新丸",
  "小小丸",
  "小丸",
  "中丸",
  "大丸",
  "大大丸",
  "超大丸",
  "巨丸",
  "饭纲丸",
  "射命丸",
];

export const LEVEL_COLORS = [
  "#4caf50",
  "#2196f3",
  "#ff9800",
  "#9c27b0",
  "#00bcd4",
  "#ff5722",
  "#8bc34a",
  "#3f51b5",
  "#245a88",
  "#ef4045",
];

export const ADMIN_BADGE = {
  name: "姬海棠",
  color: "#a72aabff",
  level: 0,
};

export type LevelBadgeMeta = {
  text: string;
  color: string;
  bg: string;
  extraTag?: string;
};

/**
 * 统一计算用户等级徽章：
 * - 匿名 / GUEST：返回 null（只显示“访客”头衔，不显示等级徽章）
 * - 普通用户：返回 levels 规则对应的等级徽章
 * - ADMIN：返回 “姬海棠 LV.0”，并额外提供 ADMIN 标记
 */
export function getLevelBadge(
  role?: Role | null,
  levelRaw?: number | null,
): LevelBadgeMeta | null {
  if (!role) return null;
  if (role === "GUEST") return null;

  if (role === "ADMIN") {
    const color = ADMIN_BADGE.color;
    return {
      text: `${ADMIN_BADGE.name} LV.${ADMIN_BADGE.level}`,
      color,
      bg: `${color}26`,
      extraTag: "ADMIN",
    };
  }

  const L = Math.max(1, Math.min(10, levelRaw || 1));
  const name = LEVEL_NAMES[L - 1];
  const color = LEVEL_COLORS[L - 1];
  return {
    text: `${name} LV.${L}`,
    color,
    bg: `${color}26`,
  };
}

