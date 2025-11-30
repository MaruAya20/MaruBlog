type Style = { bg: string; color: string; border: string };

const FALLBACK: Record<string, Style> = {
  编程: {
    bg: "rgba(34,197,94,.12)",
    color: "#b3f0c7",
    border: "rgba(34,197,94,.35)",
  },
  音乐: {
    bg: "rgba(244,63,94,.12)",
    color: "#ffc2cc",
    border: "rgba(244,63,94,.35)",
  },
  绘画: {
    bg: "rgba(234,179,8,.12)",
    color: "#ffe7a3",
    border: "rgba(234,179,8,.35)",
  },
  科技: {
    bg: "rgba(59,130,246,.12)",
    color: "#bfe1ff",
    border: "rgba(59,130,246,.35)",
  },
  生活: {
    bg: "rgba(236,72,153,.12)",
    color: "#ffbfdf",
    border: "rgba(236,72,153,.35)",
  },
  闲谈: {
    bg: "rgba(139,92,246,.12)",
    color: "#d7c8ff",
    border: "rgba(139,92,246,.35)",
  },
  其他: {
    bg: "rgba(107,114,128,.12)",
    color: "#d1d5db",
    border: "rgba(107,114,128,.35)",
  },
};

const DEFAULT_FALLBACK: Style = {
  bg: "rgba(128,128,128,.15)",
  color: "#bbb",
  border: "rgba(128,128,128,.25)",
};

// 返回统一的标签颜色样式
export function getTagStyle(name: string): Style {
  const key = (name || "").trim();
  if (!key) return DEFAULT_FALLBACK;
  return FALLBACK[key] || DEFAULT_FALLBACK;
}
