"use client";
import React from "react";
import { createPortal } from "react-dom";

export default function ImageViewer({ 
  open, 
  src, 
  onClose,
  style 
}: { 
  open: boolean; 
  src: string; 
  onClose: ()=>void;
  style?: React.CSSProperties;
}){
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const dragging = React.useRef(false);
  const start = React.useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(()=>{
    if(open){
      const prev = document.body.style.overflow;
      document.body.setAttribute('data-prev-overflow', prev);
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => { if(e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return ()=>{
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = document.body.getAttribute('data-prev-overflow') || '';
        document.body.removeAttribute('data-prev-overflow');
      };
    }
  }, [open, onClose]);

  React.useEffect(()=>{ 
    if(open){ 
      setScale(1); 
      setOffset({x:0,y:0}); 
      
      // 图片加载完成后计算合适的缩放比例
      const timer = setTimeout(() => {
        if (imgRef.current) {
          const img = imgRef.current;
          if (img.complete && img.naturalWidth > 0) {
            calculateInitialScale(img);
          } else {
            img.onload = () => calculateInitialScale(img);
          }
        }
      }, 10);
      
      return () => clearTimeout(timer);
    } 
  }, [open, src]);

  const calculateInitialScale = (img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    
    // 获取容器尺寸（减去一些padding以确保完全显示）
    const containerWidth = window.innerWidth * 0.95; // 95vw
    const containerHeight = window.innerHeight * 0.90; // 90vh

    // 计算宽高比
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = containerWidth / containerHeight;

    let newScale;
    if (imgRatio > containerRatio) {
      // 图片更宽，按宽度缩放
      newScale = containerWidth / img.naturalWidth;
    } else {
      // 图片更高，按高度缩放
      newScale = containerHeight / img.naturalHeight;
    }

    // 设置最小缩放比例，确保图像至少能贴合一侧
    setScale(Math.max(newScale, 0.1)); // 最小不为0
  };

  const clamp = (v:number, min:number, max:number)=> Math.max(min, Math.min(max, v));
  const wheel = (e: React.WheelEvent)=>{
    e.preventDefault();
    const k = e.deltaY < 0 ? 1.08 : 0.92;
    setScale(s => clamp(s*k, .25, 6));
  };
  const onDown = (e: React.PointerEvent)=>{ dragging.current=true; start.current={ x:e.clientX, y:e.clientY, ox: offset.x, oy: offset.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent)=>{ if(!dragging.current) return; const dx=e.clientX-start.current.x, dy=e.clientY-start.current.y; setOffset({ x: start.current.ox+dx, y: start.current.oy+dy }); };
  const onUp = (e: React.PointerEvent)=>{ dragging.current=false; try{ (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }catch{} };

  const dialog = (
    <div
      role="dialog"
      aria-modal
      onWheel={wheel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.65)",
        display: "grid",
        placeItems: "center",
      }}
      onClick={(e) => {
        // 点击遮罩层只关闭预览，不让事件冒泡到下面的文章卡片
        e.stopPropagation();
        onClose();
      }}
    >
      <div style={{position:'absolute', top:16, right:16}}>
        <button
          className="nav-link"
          style={{cursor:'pointer'}}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          关闭
        </button>
      </div>
      <div 
        style={{
          ...{maxWidth:'95vw', maxHeight:'90vh', border:'1px solid var(--border)', borderRadius:8, background:'rgba(0,0,0,.25)', overflow:'hidden'},
          ...style
        }} 
        onClick={(e)=>e.stopPropagation()} 
        onPointerDown={onDown} 
        onPointerMove={onMove} 
        onPointerUp={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          ref={imgRef}
          src={src} 
          alt="查看图片" 
          style={{ 
            transform:`translate(${offset.x}px, ${offset.y}px) scale(${scale})`, 
            transformOrigin:'center center', 
            transition:'transform 80ms ease', 
            display:'block', 
            maxWidth:'95vw', 
            maxHeight:'90vh', 
            objectFit:'contain', 
            userSelect:'none', 
            pointerEvents:'none' 
          }} 
        />
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}