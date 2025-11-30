"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ToastProvider";

export default function UserAutoPager({
  name,
  hasMore,
}: {
  name: string;
  hasMore: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  // 每次 hasMore 变化时重置 loading 标记
  useEffect(() => {
    loadingRef.current = false;
  }, [hasMore]);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          if (loadingRef.current) return;
          loadingRef.current = true;

          // 从当前 URL 中读取 page，默认 1
          let currentPage = 1;
          try {
            const url = new URL(window.location.href);
            const p = Number(url.searchParams.get("page") || "1");
            if (!Number.isNaN(p) && p > 0) currentPage = p;
          } catch {
            // ignore
          }

          const nextPage = currentPage + 1;
          showToast("页面更新！", "success");
          router.push(
            `/user/${encodeURIComponent(name)}?page=${nextPage}`,
            { scroll: false },
          );
        });
      },
      { rootMargin: "200px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [name, hasMore, router, showToast]);

  if (!hasMore) return null;

  return <div ref={sentinelRef} style={{ height: 1 }} />;
}

