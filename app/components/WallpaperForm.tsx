"use client";
import React from "react";

export default function WallpaperForm(){
  const [url, setUrl] = React.useState<string>("");
  const [opacity, setOpacity] = React.useState<number>(0.35);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try{
        const res = await fetch('/api/config/wallpaper', { cache: 'no-store' });
        if(!res.ok) return;
        const data = await res.json();
        if(data.url) setUrl(data.url);
        if(typeof data.opacity === 'number') setOpacity(data.opacity);
      }catch{}
    })();
  }, []);

  const applyToDOM = (u?: string, o?: number) => {
    const root = document.documentElement as HTMLElement;
    const body = document.body as HTMLElement | null;
    const hasUrl = typeof u === "string" && u.length > 0;
    const finalUrl = hasUrl ? `url("${u}")` : 'url("/wallpaper.jpg")';

    root.style.setProperty("--wallpaper-url", finalUrl);
    if (body) body.style.setProperty("--wallpaper-url", finalUrl);

    if (typeof o === "number" && !Number.isNaN(o)) {
      const v = Math.min(1, Math.max(0, o));
      root.style.setProperty("--wallpaper-opacity", String(v));
      if (body) body.style.setProperty("--wallpaper-opacity", String(v));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg("");
    try{
      const body = { url, opacity };
      const res = await fetch('/api/config/wallpaper', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if(!res.ok){ throw new Error('保存失败'); }
      const data = await res.json();
      applyToDOM(data.url, data.opacity);
      setMsg('已保存');
    }catch(err:any){ setMsg(err.message || '保存失败'); }
    finally{ setSaving(false); }
  };

  const onReset = async () => {
    setSaving(true); setMsg("");
    try{
      const res = await fetch('/api/config/wallpaper', { method: 'DELETE' });
      if(!res.ok){ throw new Error('重置失败'); }
      setUrl(""); setOpacity(0.35);
      applyToDOM('', 0.35);
      setMsg('已重置');
    }catch(err:any){ setMsg(err.message || '重置失败'); }
    finally{ setSaving(false); }
  };

  return (
    <form onSubmit={onSubmit} className="card" style={{display:'grid', gap:12}}>
      <div style={{fontWeight:600}}>壁纸与透明度</div>
      <label style={{display:'grid', gap:6}}>
        <span style={{color:'var(--muted)'}}>壁纸 URL</span>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={{padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, background:'transparent', color:'var(--text)'}} />
      </label>
      <label style={{display:'grid', gap:6}}>
        <span style={{color:'var(--muted)'}}>透明度：{opacity.toFixed(2)}</span>
        <input type="range" min={0} max={1} step={0.01} value={opacity} onChange={e=>setOpacity(parseFloat(e.target.value))} />
      </label>
      <div style={{display:'flex', gap:8}}>
        <button type="submit" className="nav-link" style={{cursor:'pointer'}} disabled={saving}>保存</button>
        <button type="button" className="nav-link" style={{cursor:'pointer'}} onClick={onReset} disabled={saving}>重置</button>
        {msg && <span className="hint">{msg}</span>}
      </div>
    </form>
  );
}
