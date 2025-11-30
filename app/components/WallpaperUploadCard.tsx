"use client";
import React from "react";
import { useToast } from "./ToastProvider";

export default function WallpaperUploadCard() {
  const [msg, setMsg] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [me, setMe] = React.useState<any>(null);
  const { showToast } = useToast();

  React.useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch(() => {});
  }, []);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // 访客 / 未登录：不允许上传，提示注册/登录
    if (!me || me.role === "GUEST") {
      showToast("注册/登录后再设置壁纸哦~", "info");
      e.target.value = "";
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/upload?kind=wallpaper", {
        method: "POST",
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) {
        throw new Error(d?.error || "上传失败");
      }
      await fetch("/api/config/wallpaper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: d.upload.url,
          opacity: 0.35,
        }),
      });
      setMsg("已上传并应用（等待管理员审核记录）");
      location.reload();
    } catch (err: any) {
      setMsg(err.message || "上传失败");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 600 }}>上传壁纸</div>
      <input
        type="file"
        accept="image/*"
        onChange={onChange}
        disabled={busy}
      />
      {msg && <div className="hint">{msg}</div>}
    </div>
  );
}

