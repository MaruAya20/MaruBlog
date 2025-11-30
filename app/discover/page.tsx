import Container from "../components/Container";
import Link from "next/link";
import InfinitePosts from "../components/InfinitePosts";
import { getTagStyle } from "@/lib/tagStyle";
import { prisma } from "@/lib/prisma";

type SP = Record<string, string | string[]>;

const PRESET_TAGS = [
  "编程",
  "音乐",
  "绘画",
  "科技",
  "生活",
  "闲谈",
  "其他",
];

export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const tagVal = sp?.tag;
  const tag = Array.isArray(tagVal) ? tagVal[0] : tagVal;
  const favVal = (sp as any)?.fav;
  const favorited = Array.isArray(favVal)
    ? favVal[0] === "1"
    : favVal === "1";
  const qVal = (sp as any)?.q;
  const q = Array.isArray(qVal) ? qVal[0] : qVal;

  // 直接从数据库读取标签定义，避免通过 /api/tags 再绕一层
  let defs = await prisma.tagDef.findMany();

  if (!defs.length) {
    // 初始化默认标签到数据库
    const created = [];
    for (const name of PRESET_TAGS) {
      const sty = getTagStyle(name);
      const row = await prisma.tagDef.create({
        data: {
          name,
          hidden: false,
          color: sty.color,
          bg: sty.bg,
          border: sty.border,
        },
      });
      created.push(row);
    }
    defs = created;
  } else {
    // 补齐缺失颜色（兼容旧数据）
    for (const t of defs) {
      if (!t.color && !t.bg && !t.border) {
        const sty = getTagStyle(t.name);
        await prisma.tagDef.update({
          where: { id: t.id },
          data: {
            color: sty.color,
            bg: sty.bg,
            border: sty.border,
          },
        });
      }
    }
    defs = await prisma.tagDef.findMany();
  }

  const visible = defs.filter((t) => !t.hidden);
  const preset = visible.map((t) => t.name);
  const presetStyles: Record<
    string,
    { bg: string; color: string; border: string }
  > = {};
  for (const t of visible) {
    const sty = getTagStyle(t.name);
    presetStyles[t.name] = {
      bg: t.bg || sty.bg,
      color: t.color || sty.color,
      border: t.border || sty.border,
    };
  }

  return (
    <Container>
      <section className="section">
        <h1 className="sr-only">发现文章</h1>
        <form
          method="get"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            margin: "8px 0 12px",
          }}
        >
          {tag && <input type="hidden" name="tag" value={tag} />}
          {favorited && <input type="hidden" name="fav" value="1" />}
          <input
            name="q"
            placeholder="搜索标题/摘要/正文/标签"
            defaultValue={q || ""}
            style={{
              flex: 1,
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <button
            className="nav-link"
            type="submit"
            style={{ cursor: "pointer" }}
          >
            搜索
          </button>
        </form>
        <div className="subnav">
          {preset.map((t) => {
            const sty =
              (presetStyles && presetStyles[t]) ||
              getTagStyle(t);
            return (
              <Link
                key={t}
                href={
                  t ? `/discover?tag=${encodeURIComponent(t)}` : "/discover"
                }
                className="chip"
                aria-current={t === tag ? "true" : undefined}
                style={{
                  background: sty.bg,
                  color: sty.color,
                  borderColor: sty.border,
                }}
              >
                # {t}
              </Link>
            );
          })}
          <Link
            href={"/discover?fav=1"}
            className="chip"
            aria-current={favorited ? "true" : undefined}
          >
            我的收藏
          </Link>
          {(tag || favorited || q) && (
            <Link href={"/discover"} className="chip">
              清除筛选
            </Link>
          )}
        </div>
        <InfinitePosts tag={tag} favorited={favorited} q={q} />
      </section>
    </Container>
  );
}
