"use client";
import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type AdminPost = {
  id: number;
  slug: string;
  title: string;
  status?: "draft" | "published";
  publishedAt: string;
  scheduledAt?: string;
  effectiveAt?: string;
  author?: { id: number; name?: string; email?: string; role?: string };
};

type StatusFilter = "all" | "published" | "draft" | "scheduled";

export default function AdminPostsPage() {
  const [me, setMe] = useState<any>(null);
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");

  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [msg, setMsg] = useState("");

  const { showToast } = useToast();

  // 加载当前用户
  useEffect(() => {
    (async () => {
      const d = await fetch("/api/me", { cache: "no-store" }).then((r) =>
        r.json(),
      );
      setMe(d.user || null);
    })().catch(() => {});
  }, []);

  // 检查后台提升状态
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

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "50");
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch("/api/admin/posts?" + params.toString(), {
        cache: "no-store",
      });
      if (r.ok) {
        const d = await r.json();
        setPosts(d.posts || []);
      } else if (r.status === 403) {
        const d = await r.json().catch(() => ({}));
        if (d?.error === "elevation_required") {
          setElevated(false);
          showToast("安全验证已失效，请重新输入管理操作码", "info");
        } else {
          setMsg("加载失败");
          showToast("加载失败", "error");
        }
      } else {
        setMsg("加载失败");
        showToast("加载失败", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  // 提升验证
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

  async function removePost(slug: string) {
    if (!slug) return;
    if (!window.confirm(`确定要删除文章「${slug}」吗？`)) return;
    const r = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    if (r.ok) {
      showToast("文章已删除", "success");
      load();
    } else if (r.status === 403) {
      const d = await r.json().catch(() => ({}));
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或删除失败", "error");
      }
    } else {
      showToast("删除失败", "error");
    }
  }

  useEffect(() => {
    if (me?.role === "ADMIN" && elevated) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, elevated, status]);

  if (!me) return null;
  if (me.role !== "ADMIN") {
    return (
      <div className="container">
        <div className="card">无权限访问该页面</div>
      </div>
    );
  }

  const statusLabel = (p: AdminPost) => {
    const status = p.status || "published";
    const sched = p.scheduledAt
      ? Date.parse(String(p.scheduledAt))
      : NaN;
    const now = Date.now();
    const isScheduledFuture =
      status === "draft" && Number.isFinite(sched) && sched > now;
    if (isScheduledFuture) return "定时（未到期）";
    if (status === "draft") return "草稿";
    return "已发布";
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
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              文章管理
            </div>
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
                完成验证后才能查看与操作文章（操作会写入后台日志）。
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as StatusFilter)
              }
              disabled={!elevated}
            >
              <option value="all">全部状态</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
              <option value="scheduled">定时（未到）</option>
            </select>
            <input
              placeholder="按标题 / 内容搜索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load();
                }
              }}
              style={{
                flex: "1 1 200px",
                minWidth: 0,
                padding: "6px 8px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--text)",
              }}
              disabled={!elevated}
            />
            <button
              type="button"
              className="nav-link"
              onClick={load}
              disabled={!elevated}
              style={{ cursor: elevated ? "pointer" : "not-allowed" }}
            >
              搜索
            </button>
          </div>

          {elevated && (
            <div
              style={{
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 8,
                display: "grid",
                gap: 8,
              }}
            >
              {!posts.length && !loading && (
                <div className="hint">当前条件下暂无文章</div>
              )}
              {posts.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: 10,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={p.title}
                    >
                      {p.title || "(无标题)"}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        flexShrink: 0,
                      }}
                    >
                      {statusLabel(p)}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    <span>
                      作者：
                      {p.author?.name ||
                        p.author?.email ||
                        `#${p.author?.id ?? "未知"}`}
                    </span>
                    <span>
                      发布时间：
                      {new Date(
                        p.effectiveAt || p.publishedAt,
                      ).toLocaleString()}
                    </span>
                    {p.scheduledAt && (
                      <span>
                        定时：{new Date(p.scheduledAt).toLocaleString()}
                      </span>
                    )}
                    <span>slug：{p.slug}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <a
                      className="nav-link"
                      href={`/post/${encodeURIComponent(p.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ cursor: "pointer" }}
                    >
                      查看
                    </a>
                    <button
                      type="button"
                      className="nav-link"
                      onClick={() => removePost(p.slug)}
                      style={{ cursor: "pointer" }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="hint">加载中，请稍候…</div>
              )}
            </div>
          )}

          {!elevated && !checkingElevated && (
            <div className="hint">
              请先完成后台安全验证后，再查看与管理文章。
            </div>
          )}

          {msg && <div className="hint">{msg}</div>}
        </div>
      </section>
    </div>
  );
}

