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
      
      // 图片加载完成后计算合适的缩放比例，让图片贴合一对水平边
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
    
    // 获取容器尺寸
    const containerWidth = window.innerWidth * 0.90;
    const containerHeight = window.innerHeight * 0.90;

    // 计算图片相对于容器的缩放比例
    const scaleX = containerWidth / img.naturalWidth;
    const scaleY = containerHeight / img.naturalHeight;
    
    // 选择较小的比例，确保图片完全适应容器
    // 这样图片就会贴合较短的那一边（要么宽度贴合容器宽度，要么高度贴合容器高度）
    const newScale = Math.min(scaleX, scaleY);

    setScale(newScale);
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

  if(!open) return null;

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
          width: '90vw', 
          height: '90vh', 
          border: '1px solid var(--border)', 
          borderRadius: 8, 
          background: 'rgba(0,0,0,.25)', 
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
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
            transition:'none', /* 无动画 */
            display:'block', 
            maxWidth: '100%',
            maxHeight: '100%',
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