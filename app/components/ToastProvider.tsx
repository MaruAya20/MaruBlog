"use client";
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type ToastType = "info" | "success" | "error";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
  leaving?: boolean;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

export default function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    // 先显示一段时间，然后渐隐并移除
    const hideDelay = 2600;
    const removeDelay = hideDelay + 400;
    window.setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
    }, hideDelay);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, removeDelay);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          right: "max(16px, 4vw)",
          bottom: "max(16px, 3vh)",
          display: "grid",
          gap: 8,
          zIndex: 9999,
          pointerEvents: "none",
          maxWidth: "min(480px, 92vw)",
        }}
      >
        {toasts.map((t) => {
          const baseBg =
            t.type === "success"
              ? "rgba(22,163,74,.92)"
              : t.type === "error"
                ? "rgba(220,38,38,.95)"
                : "rgba(31,41,55,.95)";
          return (
            <div
              key={t.id}
              className="toast-item"
              style={{
                pointerEvents: "auto",
                background: baseBg,
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 10,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
                fontSize: 20,
                lineHeight: 1.5,
                textAlign: "center",
                width: "clamp(260px, 70vw, 440px)",
                opacity: t.leaving ? 0 : 1,
                transform: t.leaving
                  ? "translate(8px, 8px)"
                  : "translate(0,0)",
                transition:
                  "opacity .35s ease-out, transform .35s ease-out",
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
