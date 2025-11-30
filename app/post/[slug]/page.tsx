import { formatYMDHM } from "@/lib/datetime";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import {
  getPostBySlug as getMdxPost,
  getPostSlugs,
  getAllPosts,
} from "@/lib/posts";
import { Store } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import Container from "@/app/components/Container";
import type { Metadata } from "next";
import {
  LikeButton,
  FavoriteButton,
  Comments,
  OwnerActions,
} from "./Actions";
import ArticleImageBinder from "@/app/components/ArticleImageBinder";
import PostThumbnailCard from "@/app/components/PostThumbnailCard";
import { getLevelBadge } from "@/lib/userLevel";
import { getTagStyle } from "@/lib/tagStyle";
import ViewTracker from "./ViewTracker";

type PostLike = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  tags?: string[];
  cover?: string;
  content: string;
};

type LoadedPost =
  | {
      source: "mdx";
      post: PostLike;
      dbPost?: null;
    }
  | {
      source: "db";
      post: PostLike;
      dbPost: {
        id: number;
        slug: string;
        title: string;
        excerpt: string | null;
        content: string;
        tags: string[];
        publishedAt: Date;
        status: string;
        scheduledAt: Date | null;
        authorId: number;
        author: {
          id: number;
          name: string | null;
          role: string;
          avatar: string | null;
          xp: number;
        } | null;
      };
    };

// 加载单篇文章：优先 MDX，其次数据库，最后回退到 JSON DB（迁移过渡用）
async function loadPost(slug: string): Promise<LoadedPost | null> {
  // 1) MDX 文章
  const mdx = getMdxPost(slug);
  if (mdx) {
    const anyMdx: any = mdx;
    return {
      source: "mdx",
      post: {
        slug: anyMdx.slug,
        title: anyMdx.title,
        date:
          anyMdx.date ||
          anyMdx.publishedAt ||
          new Date().toISOString(),
        excerpt: anyMdx.excerpt,
        tags: anyMdx.tags || [],
        cover: anyMdx.cover,
        content: anyMdx.content,
      },
      dbPost: null,
    };
  }

  // 2) 数据库中的文章
  const dbp = await prisma.post.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
          xp: true,
        },
      },
    },
  });
  if (dbp) {
    const effectiveAt = dbp.scheduledAt ?? dbp.publishedAt;
    const post: PostLike = {
      slug: dbp.slug,
      title: dbp.title,
      date: effectiveAt.toISOString(),
      excerpt: dbp.excerpt || undefined,
      tags: dbp.tags || [],
      cover: undefined,
      content: dbp.content,
    };
    return {
      source: "db",
      post,
      dbPost: {
        id: dbp.id,
        slug: dbp.slug,
        title: dbp.title,
        excerpt: dbp.excerpt,
        content: dbp.content,
        tags: dbp.tags || [],
        publishedAt: dbp.publishedAt,
        status: dbp.status,
        scheduledAt: dbp.scheduledAt,
        authorId: dbp.authorId,
        author: dbp.author
          ? {
              id: dbp.author.id,
              name: dbp.author.name,
              role: dbp.author.role,
              avatar: dbp.author.avatar,
              xp: dbp.author.xp,
            }
          : null,
      },
    };
  }

  return null;
}

// 相关文章：优先用数据库，再用 MDX 作为补充（旧实现，保留作兜底）
async function getRelatedPostsLegacy(current: PostLike): Promise<any[]> {
  const seen = new Set<string>([current.slug]);
  const related: any[] = [];
  const tags = (current.tags || []).slice(0, 3);

  // 来自数据库的相关文章（按第一个标签简单匹配）
  if (tags.length > 0) {
    try {
      const dbPosts = await prisma.post.findMany({
        where: {
          slug: { not: current.slug },
          tags: { hasSome: [tags[0]] },
          status: "published",
        },
        orderBy: { publishedAt: "desc" },
        take: 20,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              role: true,
              avatar: true,
              xp: true,
            },
          },
        },
      });

      for (const p of dbPosts) {
        if (!p.slug || seen.has(p.slug)) continue;
        seen.add(p.slug);
        const imgs = Array.from(
          String(p.content || "").matchAll(/!\[[^\]]*]\(([^)]+)\)/g),
        )
          .slice(0, 3)
          .map((m) => m[1]);
        const effectiveAt = p.scheduledAt ?? p.publishedAt;
        related.push({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt || undefined,
          tags: p.tags || [],
          content: p.content,
          publishedAt: effectiveAt.toISOString(),
          date: effectiveAt.toISOString(),
          previewImages: imgs,
          author: p.author
            ? {
                id: p.author.id,
                name: p.author.name,
                avatar: p.author.avatar,
                role: p.author.role,
                level: Store.getLevelFromXp(p.author.xp),
              }
            : undefined,
        });
        if (related.length >= 4) return related;
      }
    } catch {
      // 忽略 DB 错误，继续用 MDX 后备
    }
  }

  // 来自 MDX 文件的相关文章
  try {
    const mdxList = getAllPosts();
    for (const p of mdxList as any[]) {
      if (!p || !p.slug || seen.has(p.slug) || p.slug === current.slug) {
        continue;
      }
      if (tags.length && !(p.tags || []).some((t: string) => tags.includes(t))) {
        continue;
      }
      seen.add(p.slug);
      related.push({
        ...p,
        previewImages: p.cover ? [p.cover] : [],
        author: undefined,
      });
      if (related.length >= 4) break;
    }
  } catch {
    // ignore
  }

  return related;
}

// 相关文章新实现：先尝试旧算法，如果没有结果，再用“最新文章”兜底，避免只看到默认/空状态
async function getRelatedPosts(current: PostLike): Promise<any[]> {
  const first = await getRelatedPostsLegacy(current);
  if (first && first.length > 0) return first;

  const seen = new Set<string>([current.slug]);
  const related: any[] = [];
  try {
    const dbPosts = await prisma.post.findMany({
      where: {
        slug: { not: current.slug },
        status: "published",
      },
      orderBy: { publishedAt: "desc" },
      take: 4,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            avatar: true,
            xp: true,
          },
        },
      },
    });
    for (const p of dbPosts) {
      if (!p.slug || seen.has(p.slug)) continue;
      seen.add(p.slug);
      const imgs = Array.from(
        String(p.content || "").matchAll(/!\[[^\]]*]\(([^)]+)\)/g),
      )
        .slice(0, 3)
        .map((m) => m[1]);
      const effectiveAt = p.scheduledAt ?? p.publishedAt;
      related.push({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt || undefined,
        tags: p.tags || [],
        content: p.content,
        publishedAt: effectiveAt.toISOString(),
        date: effectiveAt.toISOString(),
        previewImages: imgs,
        author: p.author
          ? {
              id: p.author.id,
              name: p.author.name,
              avatar: p.author.avatar,
              role: p.author.role,
              level: Store.getLevelFromXp(p.author.xp),
            }
          : undefined,
      });
    }
  } catch {
    // 忽略 DB 错误，只用旧逻辑结果
  }

  return related.length > 0 ? related : first || [];
}

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const loaded = await loadPost(slug);
  if (!loaded) {
    return { title: "Not Found", description: "Post not found" };
  }
  const post = loaded.post;
  const title = post.title;
  const description = post.excerpt || title;
  const ogImage = post.cover ? [{ url: post.cover }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: ogImage },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: (ogImage && (ogImage[0] as any)?.url) || undefined,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const loaded = await loadPost(slug);
  if (!loaded) {
    return (
      <Container>
        <div className="card">未找到文章</div>
      </Container>
    );
  }
  const post = loaded.post;

  // 草稿访问控制：仅对 DB / JSON 文章生效，MDX 文章视为已发布
  if (loaded.source === "db" && loaded.dbPost) {
    const dbp = loaded.dbPost;
    if (dbp.status === "draft") {
      const scheduled = dbp.scheduledAt ? dbp.scheduledAt.getTime() : 0;
      const now = Date.now();
      const isDue = scheduled > 0 && scheduled <= now;
      if (!isDue) {
        const { getSession } = await import("@/lib/auth");
        const sess = await getSession();
        const isOwner = !!(
          sess && (sess.uid === dbp.authorId || sess.role === "ADMIN")
        );
        if (!isOwner) {
          return (
            <Container>
              <div className="card">该文章为草稿，尚未公开</div>
            </Container>
          );
        }
      }
    }
  }

  const tagStyles: Record<
    string,
    { bg: string; color: string; border: string }
  > = {};
  if (Array.isArray(post.tags) && post.tags.length) {
    const names = Array.from(
      new Set(post.tags.map((t) => String(t || "").trim()).filter(Boolean)),
    );
    if (names.length) {
      const defs = await prisma.tagDef.findMany({
        where: { name: { in: names } },
      });
      const map: Record<string, { bg: string; color: string; border: string }> =
        {};
      for (const d of defs) {
        const fallback = getTagStyle(d.name);
        map[d.name] = {
          bg: d.bg || fallback.bg,
          color: d.color || fallback.color,
          border: d.border || fallback.border,
        };
      }
      for (const name of names) {
        tagStyles[name] = map[name] || getTagStyle(name);
      }
    }
  }
  // 作者信息：DB 优先，其次 JSON；MDX 文章可能没有作者
  let author: any = undefined;
  if (loaded.source === "db" && loaded.dbPost?.author) {
    author = loaded.dbPost.author;
  }

  const related = await getRelatedPosts(post);

  return (
    <Container>
      <ViewTracker slug={post.slug} />
      <article className="card" style={{ display: "grid", gap: 12 }}>
        <header>
          <h1 style={{ margin: 0 }}>{post.title}</h1>
          {post.excerpt && (
            <div className="hint" style={{ marginTop: 4 }}>
              {post.excerpt}
            </div>
          )}
          <div className="meta" style={{ marginTop: 6 }}>
            <span className="badge date">{formatYMDHM(post.date)}</span>
            {(post.tags || []).map((t: string) => {
              const sty = tagStyles[t] || getTagStyle(t);
              return (
                <span
                  key={t}
                  className="chip"
                  style={{
                    background: sty.bg,
                    color: sty.color,
                    borderColor: sty.border,
                  }}
                >
                  # {t}
                </span>
              );
            })}
          </div>
          {author && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
              }}
            >
              <a
                href={`/user/${encodeURIComponent(author.name || "")}`}
                className="avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--border)",
                  background: "rgba(159,122,234,.12)",
                  overflow: "hidden",
                }}
              >
                {author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.avatar}
                    alt="头像"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontWeight: 700 }}>
                    {(author.name || "匿名").slice(0, 1)}
                  </span>
                )}
              </a>
              <a
                href={`/user/${encodeURIComponent(author.name || "")}`}
                style={{ textDecoration: "none", color: "var(--text)" }}
              >
                {author.name || `用户#${author.id}`}
              </a>
              {(() => {
                const level = Store.getLevelFromXp(author.xp);
                const badge = getLevelBadge(author.role as any, level);
                if (!badge) return null;
                return (
                  <>
                    <a
                      href="/levels"
                      className="user-level"
                      style={{
                        borderColor: badge.color,
                        color: badge.color,
                        background: badge.bg,
                        textDecoration: "none",
                      }}
                    >
                      {badge.text}
                    </a>
                    {badge.extraTag && (
                      <span className="user-level">{badge.extraTag}</span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </header>
        <ArticleImageBinder>
          <MDXRemote
            source={post.content}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                  rehypeSlug,
                  [rehypeAutolinkHeadings, { behavior: "wrap" }],
                ],
              },
            }}
          />
        </ArticleImageBinder>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <LikeButton slug={post.slug} />
          <FavoriteButton slug={post.slug} />
        </div>
      </article>
      {related.length > 0 && (
        <section className="section">
          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>相关帖子</div>
            <div className="grid posts">
              {related.map((r: any) => (
                <PostThumbnailCard key={r.slug} post={r} />
              ))}
            </div>
          </div>
        </section>
      )}
      <OwnerActions slug={post.slug} />
      <Comments slug={post.slug} />
    </Container>
  );
}
