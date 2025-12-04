"use client";
import React from "react";
import ImageViewer from "./ImageViewer";

export default function ArticleImageBinder({ children, className = "article" }: { children: React.ReactNode; className?: string }){
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [src, setSrc] = React.useState("");
  React.useEffect(()=>{
    const el = wrapRef.current; if(!el) return;
    const enableInlineFallback =
      className === "article" || el.classList.contains("article");
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if(!t) return;
      if(t.tagName === 'IMG'){
        e.preventDefault(); e.stopPropagation();
        const img = t as HTMLImageElement;
        // 如果存在 data-full-src，则优先使用完整大图 URL，否则退回到当前 src
        const s = img.getAttribute('data-full-src') || img.src;
        if(s){ setSrc(s); setOpen(true); }
      }
    };
    const onError = (e: Event) => {
      if (!enableInlineFallback) return;
      const t = e.target as HTMLElement | null;
      if(!t) return;
      // 图片加载失败：用文本占位替代
      if(t.tagName === 'IMG'){
        const img = t as HTMLImageElement;
        const placeholder = document.createElement('div');
        placeholder.className = 'image-missing';
        placeholder.textContent = '图片不见了！';
        img.replaceWith(placeholder);
        return;
      }
      // 音频加载失败：把整块卡片替换成“音频已下架！”
      if(t.tagName === 'AUDIO'){
        const audio = t as HTMLAudioElement;
        const card = audio.closest('[data-audio]') as HTMLElement | null;
        if(card){
          card.textContent = '音频已下架！';
          card.setAttribute('data-audio-removed', '1');
        }
      }
    };
    el.addEventListener('click', onClick, true);
    el.addEventListener('error', onError, true);
    return ()=> {
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('error', onError, true);
    };
  }, []);
  return (
    <div ref={wrapRef} className={className}>
      {children}
      <ImageViewer open={open} src={src} onClose={()=>setOpen(false)} />
    </div>
  );
}
