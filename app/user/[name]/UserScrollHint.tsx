"use client";
import { useEffect, useState } from "react";

export default function UserScrollHint({ hasMore }: { hasMore: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasMore) return;
    let hideTimer: number | undefined;
    const onScroll = () => {
      if (!hasMore) return;
      if (visible) return;
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || 0;
      const docHeight = document.documentElement.scrollHeight || 0;
      if (scrollTop + viewportHeight >= docHeight - 40) {
        setVisible(true);
        hideTimer = window.setTimeout(() => {
          setVisible(false);
        }, 3000);
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [hasMore, visible]);

  if (!visible || !hasMore) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(0,0,0,.78)",
        color: "#fff",
        fontSize: 12,
        maxWidth: 260,
        boxShadow: "0 8px 20px rgba(0,0,0,.35)",
        zIndex: 50,
      }}
    >
      已到列表底部，点击下方“加载更多”按钮获取下一批文章。
    </div>
  );
}

