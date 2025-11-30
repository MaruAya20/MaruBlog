"use client";
import { useEffect, useState } from "react";
import { getTagStyle } from "@/lib/tagStyle";

export default function MyPosts() {
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me", {
        cache: "no-store",
      }).then((r) => r.json());
      setMe(meRes.user || null);
      if (meRes.user) {
        const data = await fetch(
          `/api/posts?authorId=${meRes.user.id}&pageSize=50`,
          { cache: "no-store" },
        ).then((r) => r.json());
        setItems(data.posts || []);
      } else {
        setItems([]);
      }
    })();
  }, []);

  if (items === null) return null;
  if (!items.length)
    return <div className="hint">这里还没有文章哦</div>;

  return (
    <div className="grid posts">
      {items.map((p: any) => (
        <article
          key={p.slug}
          className="card post"
          style={{ display: "grid", gap: 8 }}
        >
          <div className="title">{p.title}</div>
          {p.excerpt && (
            <div className="excerpt">{p.excerpt}</div>
          )}
          <div className="meta">
            <span className="badge date">
              {new Date(p.publishedAt || p.date).toLocaleString()}
            </span>
            {(p.tags || []).map((t: string) => {
              const sty =
                (p.tagStyles && p.tagStyles[t]) ||
                getTagStyle(t);
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            <div
              className="avatar-circle"
              style={{ width: 28, height: 28 }}
            >
              {me?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.avatar}
                  alt="头像"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                (me?.name || "未命名").slice(0, 1)
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              {me?.name || "未命名"}
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <a
              className="nav-link"
              href={`/post/${encodeURIComponent(p.slug)}`}
            >
              查看全文
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
