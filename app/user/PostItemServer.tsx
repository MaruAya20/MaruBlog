import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { getPostBySlug as getMdxPost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { formatYMDHM } from "@/lib/datetime";
import {
  LikeButton,
  FavoriteButton,
  Comments,
  OwnerActions,
} from "../post/[slug]/Actions";
import ArticleImageBinder from "@/app/components/ArticleImageBinder";
import { getTagStyle } from "@/lib/tagStyle";

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
  | { source: "mdx"; post: PostLike }
  | { source: "db"; post: PostLike };

// 与文章详情页类似：优先 MDX，其次数据库（不再回退 JSON）
async function loadPost(
  slug: string,
): Promise<LoadedPost | null> {
  // 1) MDX
  const mdx = getMdxPost(slug) as any;
  if (mdx) {
    return {
      source: "mdx",
      post: {
        slug: mdx.slug,
        title: mdx.title,
        date:
          mdx.date ||
          mdx.publishedAt ||
          new Date().toISOString(),
        excerpt: mdx.excerpt,
        tags: mdx.tags || [],
        cover: mdx.cover,
        content: mdx.content,
      },
    };
  }

  // 2) 数据库
  const dbp = await prisma.post.findUnique({
    where: { slug },
  });
  if (dbp) {
    const effectiveAt = dbp.scheduledAt ?? dbp.publishedAt;
    return {
      source: "db",
      post: {
        slug: dbp.slug,
        title: dbp.title,
        date: effectiveAt.toISOString(),
        excerpt: dbp.excerpt || undefined,
        tags: dbp.tags || [],
        cover: undefined,
        content: dbp.content,
      },
    };
  }

  return null;
}

export default async function PostItemServer({
  slug,
}: {
  slug: string;
}) {
  const loaded = await loadPost(slug);
  if (!loaded) return null;
  const post = loaded.post;

  const tagStyles: Record<
    string,
    { bg: string; color: string; border: string }
  > = {};
  if (Array.isArray(post.tags) && post.tags.length) {
    const names = Array.from(
      new Set(
        post.tags
          .map((t) => String(t || "").trim())
          .filter(Boolean),
      ),
    );
    if (names.length) {
      const defs = await prisma.tagDef.findMany({
        where: { name: { in: names } },
      });
      const map: Record<
        string,
        { bg: string; color: string; border: string }
      > = {};
      for (const d of defs) {
        const fallback = getTagStyle(d.name);
        map[d.name] = {
          bg: d.bg || fallback.bg,
          color: d.color || fallback.color,
          border: d.border || fallback.border,
        };
      }
      for (const name of names) {
        tagStyles[name] =
          map[name] || getTagStyle(name);
      }
    }
  }

  return (
    <article
      className="card"
      style={{ display: "grid", gap: 12 }}
    >
      <header>
        <h2 style={{ margin: 0 }}>{post.title}</h2>
        {post.excerpt && (
          <div
            className="hint"
            style={{ marginTop: 4 }}
          >
            {post.excerpt}
          </div>
        )}
        <div
          className="meta"
          style={{ marginTop: 6 }}
        >
          <span className="badge date">
            {formatYMDHM(post.date)}
          </span>
          {(post.tags || []).map((t: string) => {
            const sty =
              tagStyles[t] || getTagStyle(t);
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
      </header>
      <ArticleImageBinder>
        <MDXRemote
          source={post.content}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm],
              rehypePlugins: [
                rehypeSlug,
                [
                  rehypeAutolinkHeadings,
                  { behavior: "wrap" },
                ],
              ],
            },
          }}
        />
      </ArticleImageBinder>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <LikeButton slug={post.slug} />
        <FavoriteButton slug={post.slug} />
      </div>
      <OwnerActions slug={post.slug} />
      <Comments slug={post.slug} />
    </article>
  );
}

