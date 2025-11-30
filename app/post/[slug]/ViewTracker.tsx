"use client";

import { useEffect } from "react";

export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    const url = `/api/track/view?slug=${encodeURIComponent(slug)}`;
    fetch(url, {
      method: "POST",
      signal: controller.signal,
    }).catch(() => {});
    return () => controller.abort();
  }, [slug]);

  return null;
}

