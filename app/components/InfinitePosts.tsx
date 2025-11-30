"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PostThumbnailCard from "@/app/components/PostThumbnailCard";

export default function InfinitePosts({
  tag,
  favorited,
  q,
}: {
  tag?: string;
  favorited?: boolean;
  q?: string;
}) {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current || loading || !hasMore) return;
    busy.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      // 发现页一次加载 30 条
      params.set("pageSize", "30");
      if (tag) params.set("tag", tag);
      if (favorited) params.set("favorited", "1");
      if (q) params.set("q", q);
      const res = await fetch("/api/posts?" + params.toString(), {
        cache: "no-store",
      });
      const data = await res.json();
      setItems((prev) => {
        const map = new Map(prev.map((x: any) => [x.slug, x]));
        (data.posts || []).forEach((x: any) => {
          if (!map.has(x.slug)) map.set(x.slug, x);
        });
        return Array.from(map.values());
      });
      setHasMore(Boolean(data.hasMore));
      setPage((p) => p + 1);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [page, hasMore, loading, tag, favorited, q]);

  useEffect(() => {
    // tag / 收藏 / 搜索变更时重置
    setItems([]);
    setPage(1);
    setHasMore(true);
    initialized.current = false;
  }, [tag, favorited, q]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) load();
        });
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    if (!initialized.current) {
      initialized.current = true;
      load();
    }
    return () => io.disconnect();
  }, [load, tag]);

  return (
    <>
      <div className="grid posts">
        {items.map((p) => (
          <PostThumbnailCard key={p.slug} post={p} />
        ))}
      </div>
      <div ref={sentinel} style={{ height: 1 }} />
      {loading && (
        <div
          className="hint"
          style={{ textAlign: "center", marginTop: 8 }}
        >
          加载中...
        </div>
      )}
      {!hasMore && (
        <div
          className="hint"
          style={{ textAlign: "center", marginTop: 8 }}
        >
          没有更多了
        </div>
      )}
    </>
  );
}
