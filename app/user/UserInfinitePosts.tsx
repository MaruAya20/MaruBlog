"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PostThumbnailCard from "@/app/components/PostThumbnailCard";

export default function UserInfinitePosts() {
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const pageRef = useRef(1);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const busy = useRef(false);
  const initialLoaded = useRef(false);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user || null));
  }, []);

  const load = useCallback(async () => {
    if (!me) return;
    if (busy.current || loadingRef.current || !hasMoreRef.current) return;
    busy.current = true;
    setLoading(true);
    loadingRef.current = true;
    try {
      const page = pageRef.current;
      const q = new URLSearchParams();
      q.set("page", String(page));
      // “我的”界面一次加载 8 篇文章
      q.set("pageSize", "8");
      q.set("authorId", String(me.id));
      const res = await fetch("/api/posts?" + q.toString(), {
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
      const more = Boolean(data.hasMore);
      setHasMore(more);
      hasMoreRef.current = more;
      if (more) {
        pageRef.current = page + 1;
      }
    } finally {
      busy.current = false;
      setLoading(false);
      loadingRef.current = false;
    }
  }, [me]);

  // 首次拿到当前用户后，加载第一页
  useEffect(() => {
    if (!me || initialLoaded.current) return;
    initialLoaded.current = true;
    load();
  }, [me, load]);

  // 监听滚动，在接近底部时加载下一页
  useEffect(() => {
    const onScroll = () => {
      if (!me) return;
      if (!hasMoreRef.current || loadingRef.current) return;
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || 0;
      // 只在向下滚动时才考虑加载，避免初始 0 或抖动触发多次
      if (scrollTop <= lastScrollTopRef.current) {
        lastScrollTopRef.current = scrollTop;
        return;
      }
      lastScrollTopRef.current = scrollTop;
      const viewportHeight = window.innerHeight || 0;
      const docHeight = document.documentElement.scrollHeight || 0;
      if (scrollTop + viewportHeight >= docHeight - 200) {
        load();
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [load, me]);

  if (!me) return null;

  return (
    <div>
      <div className="grid posts">
        {items.map((p: any) => (
          <PostThumbnailCard
            key={p.slug}
            post={p}
            showMissingImageFallback
          />
        ))}
      </div>
      {loading && (
        <div
          className="hint"
          style={{ textAlign: "center", marginTop: 8 }}
        >
          加载中...
        </div>
      )}
      {!loading && !hasMore && (
        <div
          className="hint"
          style={{ textAlign: "center", marginTop: 8 }}
        >
          没有更多了
        </div>
      )}
    </div>
  );
}

