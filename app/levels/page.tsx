import Container from "../components/Container";
import { getSession } from "@/lib/auth";
import { Store } from "@/lib/store";
import { prisma } from "@/lib/prisma";

export default async function Levels() {
  // 等级表本身仍然在前端本地计算
  const LEVEL_NAMES = [
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
  const LEVEL_COLORS = [
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
  const ADMIN = { name: "姬海棠", color: "#a72aabff", level: 0 };
  const total = 1_000_000;
  const thresholdFor = (L: number) =>
    Math.round(total * Math.pow(Math.max(1, Math.min(10, L)) / 10, 2));
  const levels = Array.from({ length: 10 }, (_, i) => {
    const L = i + 1;
    const min = L === 1 ? 0 : thresholdFor(L);
    const max = L === 10 ? total : thresholdFor(L + 1) - 1;
    return {
      level: L,
      name: LEVEL_NAMES[i],
      color: LEVEL_COLORS[i],
      minXp: min,
      maxXp: max,
    };
  });

  // 当前用户：从 Prisma.User 读取 XP 与今日 XP，再用 Store.getLevelFromXp 计算等级
  const sess = await getSession();
  let level = 0;
  let xp = 0;
  let xpToday = 0;

  if (sess) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: sess.uid },
        select: {
          role: true,
          xp: true,
          xpToday: true,
        },
      });
      if (u) {
        xp = u.xp ?? 0;
        xpToday = u.xpToday ?? 0;
        level =
          u.role === "ADMIN"
            ? 0
            : Store.getLevelFromXp(u.xp ?? 0);
      }
    } catch {
      // 忽略读取错误，保持默认 0 值
    }
  }

  const curMeta =
    level === 0
      ? null
      : levels.find((l) => l.level === level) || levels[0];
  const curMin = level === 0 ? 0 : curMeta?.minXp || 0;
  const nextMax =
    level >= 10
      ? total
      : levels.find((l) => l.level === Math.max(1, level) + 1)
          ?.minXp || total;
  const denom = Math.max(1, nextMax - curMin);
  const progress = Math.max(
    0,
    Math.min(1, (xp - curMin) / denom),
  );
  const cur =
    level === 0
      ? ADMIN
      : {
          name: curMeta!.name,
          color: curMeta!.color,
          level,
        };

  return (
    <Container>
      <section className="section">
        <div
          className="card"
          style={{ display: "grid", gap: 12 }}
        >
          <div style={{ fontWeight: 600 }}>等级概览</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              className="user-level"
              style={{
                borderColor: cur.color,
                color: cur.color,
                background: `${cur.color}26`,
              }}
            >{`${cur.name} LV.${level || 0}`}</span>
          </div>
          <div>累计经验值：{xp}</div>
          <div>今日获得经验值：{xpToday}</div>
          <div>
            <div className="hint">
              当前等级进度：
              {level >= 10
                ? "已达最高等级"
                : `${(progress * 100).toFixed(1)}%`}，
              {xp - curMin} / {denom}
            </div>
            <div
              style={{
                height: 10,
                background: "rgba(255,255,255,.1)",
                borderRadius: 999,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, progress * 100)}%`,
                  background: cur.color,
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
          <div>
            提示：
            {level >= 10
              ? "已达到最高等级，继续活跃以展示实力吧。"
              : "多发文章、多点赞评论即可获得经验，提升等级。"}
          </div>
        </div>
      </section>
      <section className="section">
        <div
          className="card"
          style={{ display: "grid", gap: 10 }}
        >
          <div style={{ fontWeight: 600 }}>
            全部等级档位及经验范围
          </div>
          <div
            style={{ display: "grid", gap: 8 }}
          >
            {levels.map((l) => (
              <div
                key={l.level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  className="user-level"
                  style={{
                    borderColor: l.color,
                    color: l.color,
                    background: `${l.color}26`,
                  }}
                >{`${l.name} LV.${l.level}`}</span>
                <span className="hint">
                  {l.minXp} ~ {l.maxXp}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                className="user-level"
                style={{
                  borderColor: ADMIN.color,
                  color: ADMIN.color,
                  background: `${ADMIN.color}26`,
                }}
              >{`${ADMIN.name} LV.${ADMIN.level}`}</span>
              <span className="hint">
                管理员拥有独立头衔，不参与普通等级计算。
              </span>
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}

