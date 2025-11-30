"use client";
import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type UploadStatus = "pending" | "approved" | "rejected";
type UploadKind = "avatar" | "wallpaper" | "other" | "";

export default function AdminUploads() {
  const [me, setMe] = useState<any>(null);
  const [status, setStatus] = useState<UploadStatus>("pending");
  const [kind, setKind] = useState<UploadKind>("");
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");
  const { showToast } = useToast();

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (kind) params.set("kind", kind);
    const r = await fetch(`/api/admin/uploads?${params.toString()}`, {
      cache: "no-store",
    });
    if (r.ok) {
      const d = await r.json();
      setList(d.uploads || []);
      setMsg("");
    } else if (r.status === 403) {
      const d = await r.json().catch(() => ({}));
      if (d?.error === "elevation_required") {
        setElevated(false);
        setMsg("需要完成后台安全验证后才能查看上传列表。");
        showToast("请先完成管理操作验证", "info");
      } else {
        setMsg("加载失败");
        showToast("加载失败", "error");
      }
    } else {
      setMsg("加载失败");
      showToast("加载失败", "error");
    }
  }

  useEffect(() => {
    (async () => {
      const d = await fetch("/api/me", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      setMe(d.user);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    if (!me || me.role !== "ADMIN") return;
    (async () => {
      try {
        const r = await fetch("/api/admin/status", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setElevated(Boolean(d.elevated));
        } else {
          setElevated(false);
        }
      } finally {
        setCheckingElevated(false);
      }
    })().catch(() => {
      setCheckingElevated(false);
    });
  }, [me]);

  useEffect(() => {
    if (me?.role === "ADMIN" && elevated) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, elevated, status, kind]);

  async function verify() {
    const value = code.trim();
    if (!value) {
      showToast("请输入管理操作码", "info");
      return;
    }
    const r = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) {
      setElevated(true);
      setCode("");
      setMsg("");
      showToast("已通过后台安全验证", "success");
      load();
    } else {
      if (d?.error === "invalid_code") {
        showToast("操作码错误，请重试", "error");
      } else if (d?.error === "missing_code") {
        showToast("请输入管理操作码", "info");
      } else {
        showToast(d?.error || "验证失败", "error");
      }
    }
  }

  async function act(id: number, action: "approve" | "reject") {
    const r = await fetch(`/api/admin/uploads/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (r.ok) {
      showToast(
        action === "approve" ? "已通过该资源" : "已拒绝该资源",
        "success",
      );
      load();
    } else if (r.status === 403) {
      const d = await r.json().catch(() => ({}));
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或操作失败", "error");
      }
    } else {
      setMsg("操作失败");
      showToast("操作失败", "error");
    }
  }

  async function cleanupUnused() {
    const r = await fetch("/api/admin/uploads/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      const n = d?.removedCount ?? 0;
      if (n > 0) {
        showToast(`已清理 ${n} 个未使用资源`, "success");
      } else {
        showToast("没有检测到未使用的资源", "info");
      }
      load();
    } else if (r.status === 403) {
      const d = await r.json().catch(() => ({}));
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或操作失败", "error");
      }
    } else {
      showToast("清理失败", "error");
    }
  }

  if (!me) return null;
  if (me.role !== "ADMIN") {
    return (
      <div className="container">
        <div className="card">无权限访问该页面</div>
      </div>
    );
  }

  const statusLabel: Record<UploadStatus, string> = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
  };

  const kindLabel: Record<string, string> = {
    avatar: "头像",
    wallpaper: "壁纸",
    other: "其他",
  };

  return (
    <div className="container">
      <section className="section">
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 600 }}>上传资源审核</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              安全状态：
              {checkingElevated
                ? "检测中…"
                : elevated
                  ? "已验证"
                  : "未验证"}
            </div>
          </div>

          {!checkingElevated && !elevated && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="password"
                placeholder="输入管理操作码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{
                  flex: "1 1 160px",
                  minWidth: 0,
                  padding: "6px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--text)",
                }}
              />
              <button
                className="nav-link"
                type="button"
                onClick={verify}
                style={{ cursor: "pointer" }}
              >
                验证
              </button>
              <span className="hint">
                完成验证后才能查看与操作上传资源（默认操作码为 123456，可在
                .env 中配置 ADMIN_OP_CODE）。
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as UploadStatus)}
              disabled={!elevated}
            >
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as UploadKind)}
              disabled={!elevated}
            >
              <option value="">全部类型</option>
              <option value="avatar">头像</option>
              <option value="wallpaper">壁纸</option>
              <option value="other">其他</option>
            </select>
            <button
              type="button"
              className="nav-link"
              onClick={cleanupUnused}
              disabled={!elevated}
              style={{ cursor: elevated ? "pointer" : "not-allowed" }}
            >
              清理未使用资源
            </button>
          </div>

          {elevated && (
            <div
              className="grid posts"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill,minmax(220px,1fr))",
              }}
            >
              {list.map((u: any) => (
                <div
                  key={u.id}
                  className="card"
                  style={{ display: "grid", gap: 8 }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    #{u.id} · {kindLabel[u.kind] || u.kind} ·{" "}
                    {statusLabel[u.status as UploadStatus] || u.status}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.url}
                    alt={u.originalName || u.filename}
                    style={{ width: "100%", borderRadius: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="nav-link"
                      type="button"
                      onClick={() => act(u.id, "approve")}
                      style={{ cursor: "pointer" }}
                    >
                      通过
                    </button>
                    <button
                      className="nav-link"
                      type="button"
                      onClick={() => act(u.id, "reject")}
                      style={{ cursor: "pointer" }}
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
              {!list.length && (
                <div className="hint">当前条件下暂无上传记录</div>
              )}
            </div>
          )}

          {!elevated && !checkingElevated && (
            <div className="hint">
              请先完成后台安全验证后，再进行上传资源审核操作。
            </div>
          )}

          {msg && <div className="hint">{msg}</div>}
        </div>
      </section>
    </div>
  );
}
