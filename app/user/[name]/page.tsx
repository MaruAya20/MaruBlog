import Container from "../../components/Container";
import { Store } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import PostItemServer from "../PostItemServer";
import UserProfileCard from "../UserProfileCard";
import UserScrollHint from "./UserScrollHint";
import UserAutoPager from "./UserAutoPager";
import { getLevelBadge } from "@/lib/userLevel";

export default async function UserByName({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const sp = await searchParams;
  const pageRaw = sp?.page;
  const page =
    pageRaw && !Number.isNaN(Number(pageRaw))
      ? Math.max(1, Number(pageRaw))
      : 1;

  // 优先从数据库按昵称读取用户，保证新注册用户也能正确展示
  let found:
    | {
        id: number;
        name: string | null;
        role: string;
        avatar?: string | null;
        signature?: string | null;
        xp?: number | null;
      }
    | null = await prisma.user.findFirst({
    where: { name },
    select: {
      id: true,
      name: true,
      role: true,
      avatar: true,
      signature: true,
      xp: true,
    },
  });

  // 兼容旧数据：如数据库未找到，则回退到 JSON 用户
  // 所有在线用户都来自 Prisma，不再从旧 JSON DB 回退

  const sess = await getSession();
  const isSelf = !!(sess && found && sess.uid === found.id);

  const pageSize = 8;
  const effectivePageSize = pageSize * page;

  // 文章列表已改用数据库读取，保持展示形式不变
  let posts: { slug: string }[] = [];
  let hasMore = false;

  if (found) {
    const where: any = {
      authorId: found.id,
    };
    const now = new Date();
    // 仅展示已发布或已到期的定时文章
    where.OR = [
      { status: "published" },
      {
        AND: [
          { status: "draft" },
          { scheduledAt: { not: null, lte: now } },
        ],
      },
    ];

    const total = await prisma.post.count({ where });
    const list = await prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: 0,
      take: effectivePageSize,
      select: { slug: true },
    });
    posts = list;
    hasMore = effectivePageSize < total;
  }

  const foundLevel =
    found && typeof found.xp === "number"
      ? (Store as any).getLevelFromXp(found.xp)
      : null;
  const foundBadge = found
    ? getLevelBadge(found.role as any, foundLevel)
    : null;

  return (
    <Container>
      <section className="section">
        <h1 className="sr-only">用户页面</h1>
        {isSelf ? (
          <UserProfileCard />
        ) : (
          <div
            className="card"
            style={{ display: "flex", gap: 16, alignItems: "center" }}
          >
            <div className="avatar-circle" aria-label="用户头像">
              {found?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={found.avatar}
                  alt="头像"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                (found?.name || "访客").slice(0, 1)
              )}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {found?.name || "访客"}
                </div>
                {foundBadge && (
                  <>
                    <a
                      href="/levels"
                      className="user-level"
                      style={{
                        borderColor: foundBadge.color,
                        color: foundBadge.color,
                        background: foundBadge.bg,
                        textDecoration: "none",
                      }}
                    >
                      {foundBadge.text}
                    </a>
                    {foundBadge.extraTag && (
                      <span className="user-level">
                        {foundBadge.extraTag}
                      </span>
                    )}
                  </>
                )}
              </div>
              {found?.signature && (
                <div className="user-sign">
                  {found.signature}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <section className="section" style={{ display: "grid", gap: 12 }}>
        {posts.map((p) => (
          <PostItemServer key={p.slug} slug={p.slug} />
        ))}
        {!posts.length && <div className="hint">暂无文章</div>}
        <UserAutoPager name={name} hasMore={hasMore} />
      </section>
      <UserScrollHint hasMore={hasMore} />
    </Container>
  );
}
