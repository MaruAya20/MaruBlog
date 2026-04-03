"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatYMDHM } from "@/lib/datetime";
import ArticleImageBinder from "@/app/components/ArticleImageBinder";
import { getLevelBadge } from "@/lib/userLevel";
import { getTagStyle } from "@/lib/tagStyle";

// 小卡片里的预览图：使用缩略图 URL 作为 src，同时把完整图 URL 放到 data-full-src，方便预览组件读取
function PreviewImage({ thumb, full }: { thumb: string; full?: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={thumb}
      src={thumb}
      data-full-src={full || thumb}
      alt="预览"
      onError={() => setVisible(false)}
      style={{
        width: 88,
        height: 88,
        objectFit: "cover",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    />
  );
}

export default function PostThumbnailCard({
  post,
  showMissingImageFallback = false,
}: {
  post: any;
  showMissingImageFallback?: boolean;
}) {
  const router = useRouter();
  const p = post || {};
  const badge = getLevelBadge(p.author?.role, p.author?.level);
  const likes = typeof (p as any).likes === "number" ? (p as any).likes : undefined;
  const favorites =
    typeof (p as any).favorites === "number"
      ? (p as any).favorites
      : undefined;

  // 生成摘要的函数：如果已经有摘要则直接使用，否则从内容中提取文本并截取前100个字符
  const generateExcerpt = () => {
    if (p.excerpt) return p.excerpt;
    if (p.content) {
      // 移除HTML和Markdown标签，获取纯文本内容
      // 先去除Markdown链接语法，保留链接文本
      let plainText = p.content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      // 去除音频标签
      plainText = plainText.replace(/\[audio:([^\]]+)\]\([^)]+\)/g, '');
      // 去除粗体、斜体等标记
      plainText = plainText.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1');
      // 去除标题标记
      plainText = plainText.replace(/^#+\s+/gm, '');
      // 去除引用标记
      plainText = plainText.replace(/^\s*>+\s*/gm, '');
      // 去除代码块标记
      plainText = plainText.replace(/`{3}[\s\S]*?\n`{3}|`([^`]+)`/g, '$1');
      // 去除其他HTML标签
      plainText = plainText.replace(/<[^>]*>/g, '');
      // 去除多余的空白字符
      plainText = plainText.replace(/\s+/g, ' ').trim();
      // 截取前100个字符作为摘要
      return plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '');
    }
    return "";
  };

  return (
    <article
      key={p.slug}
      className="card post"
      role="link"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        if ((e as any).defaultPrevented) return;
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return;
        const t = e.target as HTMLElement | null;
        if (!t) return;
        if (
          t.closest(
            "a,button,[role=\"button\"],input,textarea,select,.avatar,.user-level,img",
          )
        )
          return;
        if (p.slug) router.push(`/post/${encodeURIComponent(p.slug)}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.currentTarget as any).click?.();
        }
      }}
    >
      {(() => {
        return null;
      })()}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <a
          href={
            p.author?.name
              ? `/user/${encodeURIComponent(p.author.name)}`
              : "#"
          }
          className="avatar"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            border: "1px solid var(--border)",
            background: "rgba(159,122,234,.12)",
            overflow: "hidden",
          }}
        >
          {p.author?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.author.avatar}
              alt="头像"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span style={{ fontWeight: 700 }}>
              {(p.author?.name || "匿名").slice(0, 1)}
            </span>
          )}
        </a>
        <a
          href={
            p.author?.name
              ? `/user/${encodeURIComponent(p.author.name)}`
              : "#"
          }
          style={{
            fontSize: 13,
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          {p.author?.name || "匿名"}
        </a>
        {/* 匿名/访客不显示等级徽章，注册用户与管理员统一用 levels 样式 */}
        {badge && (
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
        )}
      </div>
      <div
        className="title"
        title={p.title}
        style={{
          color: "var(--text)",
          textDecoration: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {p.title}
      </div>
      <div
        className="excerpt"
        title={generateExcerpt()}
        style={{
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2 as any,
          WebkitBoxOrient: "vertical" as any,
        }}
      >
        {generateExcerpt()}
      </div>
      {(() => {
        const imgs: string[] = Array.isArray((p as any).previewImages)
          ? (p as any).previewImages
          : [];
        const thumbs: string[] = Array.isArray((p as any).previewThumbs)
          ? (p as any).previewThumbs
          : imgs;
        if (!imgs.length && !thumbs.length) return null;
        const pairs = imgs.slice(0, 3).map((full: string, idx: number) => ({
          full,
          thumb: thumbs[idx] || full,
        }));
        if (!pairs.length) return null;
        return (
          <ArticleImageBinder
            className={showMissingImageFallback ? "article" : ""}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {pairs.map(({ full, thumb }) =>
                showMissingImageFallback ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={thumb}
                    src={thumb}
                    data-full-src={full}
                    alt="预览"
                    loading="lazy"
                    style={{
                      width: 88,
                      height: 88,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                ) : (
                  <PreviewImage key={thumb} thumb={thumb} full={full} />
                ),
              )}
            </div>
          </ArticleImageBinder>
        );
      })()}
      <div className="meta">
        <span className="badge date">
          {formatYMDHM(p.publishedAt || p.date)}
        </span>
        {(p.tags || []).map((t: string) => {
          const sty =
            (p.tagStyles && p.tagStyles[t]) || getTagStyle(t);
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
      {(likes ?? 0) + (favorites ?? 0) > 0 && (
        <div
          className="hint"
          style={{
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {typeof likes === "number" && (
            <span>
              赞 {likes}
            </span>
          )}
          {typeof favorites === "number" && (
            <span style={{ marginLeft: 8 }}>
              收藏 {favorites}
            </span>
          )}
        </div>
      )}
    </article>
  );
}