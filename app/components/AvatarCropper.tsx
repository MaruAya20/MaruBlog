"use client";
import React from "react";

type Props = {
  open: boolean;
  file?: File | null;
  onClose: () => void;
  onCropped: (blob: Blob) => void | Promise<void>;
};

const VIEWPORT = 300; // 裁剪预览区域为 300×300

export default function AvatarCropper({
  open,
  file,
  onClose,
  onCropped,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const imageRef = React.useRef<HTMLImageElement | null>(null);

  const [ready, setReady] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const zoomRef = React.useRef(1);
  const baseScaleRef = React.useRef(1); // 让图片长边适配裁剪框的基础缩放倍数
  const centerRef = React.useRef({ x: 0, y: 0 }); // 图片坐标系中的裁剪中心

  const draggingRef = React.useRef(false);
  const dragStartRef = React.useRef({
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
  });

  // 弹窗打开时锁定 body 滚动
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.setAttribute("data-prev-overflow", prev);
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow =
          document.body.getAttribute("data-prev-overflow") || "";
        document.body.removeAttribute("data-prev-overflow");
      };
    }
  }, [open]);

  const redraw = React.useCallback(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const viewport = VIEWPORT;
    const scale = baseScaleRef.current * zoomRef.current;
    const size = viewport / scale; // 裁剪区域在图片坐标系下的边长

    let { x: cx, y: cy } = centerRef.current;
    const half = size / 2;

    // 约束中心点，避免裁剪框跑出图片边界
    if (cx < half) cx = half;
    if (cx > iw - half) cx = iw - half;
    if (cy < half) cy = half;
    if (cy > ih - half) cy = ih - half;
    centerRef.current = { x: cx, y: cy };

    const sx = cx - half;
    const sy = cy - half;

    ctx.clearRect(0, 0, viewport, viewport);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, size, size, 0, 0, viewport, viewport);
  }, []);

  const initViewport = React.useCallback(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const viewport = VIEWPORT;
    // 按图片长边适配裁剪框：长边刚好等于 viewport
    const s0 = Math.min(viewport / iw, viewport / ih);
    baseScaleRef.current = s0;
    zoomRef.current = 1;
    setZoom(1);

    // 初始以图片中心作为裁剪中心
    centerRef.current = { x: iw / 2, y: ih / 2 };

    redraw();
    setReady(true);
  }, [redraw]);

  // 当选择新文件时，加载图片并初始化裁剪视图
  React.useEffect(() => {
    setReady(false);
    zoomRef.current = 1;
    setZoom(1);
    baseScaleRef.current = 1;
    centerRef.current = { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, VIEWPORT, VIEWPORT);
    }

    if (!file) {
      imageRef.current = null;
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      initViewport();
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, initViewport]);

  const clampZoom = (v: number) => Math.min(4, Math.max(0.25, v));

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    draggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cx: centerRef.current.x,
      cy: centerRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const scale = baseScaleRef.current * zoomRef.current;
    if (!scale) return;

    // 将屏幕位移转换为图片坐标系的位移
    const deltaX = dx / scale;
    const deltaY = dy / scale;

    centerRef.current = {
      x: dragStartRef.current.cx - deltaX,
      y: dragStartRef.current.cy - deltaY,
    };
    redraw();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!ready) return;
    const prev = zoomRef.current;
    const next = clampZoom(prev * (e.deltaY < 0 ? 1.1 : 0.9));
    if (next === prev) return;
    zoomRef.current = next;
    setZoom(next);
    redraw();
  };

  const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    const next = clampZoom(Number.isFinite(v) ? v : 1);
    zoomRef.current = next;
    setZoom(next);
    redraw();
  };

  const confirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("toBlob failed"));
        },
        "image/jpeg",
        0.92,
      );
    });
    await onCropped(blob);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.5)", // 框外半透明遮罩
        display: "grid",
        placeItems: "center",
        overscrollBehavior: "contain",
      }}
    >
      <div
        className="card"
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          width: "min(92vw, 520px)",
        }}
      >
        <div style={{ fontWeight: 600 }}>裁剪头像</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              width: VIEWPORT,
              height: VIEWPORT,
              margin: "0 auto",
              overflow: "hidden",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,.35)",
            }}
          >
            <canvas
              ref={canvasRef}
              width={VIEWPORT}
              height={VIEWPORT}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={onWheel}
              style={{
                display: "block",
                width: VIEWPORT,
                height: VIEWPORT,
                cursor: ready ? "grab" : "default",
              }}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "var(--muted)" }}>
              缩放（滚轮调整）：{zoom.toFixed(2)}
            </label>
            <input
              aria-label="scale"
              type="range"
              min={0.25}
              max={4}
              step={0.01}
              value={zoom}
              onChange={onSliderChange}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            className="nav-link"
            onClick={onClose}
            style={{ cursor: "pointer" }}
          >
            取消
          </button>
          <button
            className="nav-link"
            onClick={confirm}
            disabled={!ready}
            style={{ cursor: "pointer" }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

