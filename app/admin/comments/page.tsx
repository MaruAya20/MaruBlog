"use client";
import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type AdminComment = {
  id: number;
  postSlug: string;
  content: string;
  createdAt: string;
  userId?: number;
  guestName?: string;
  banned?: boolean;
  user?: { id: number; name?: string; email?: string; role?: string };
};

export default function AdminCommentsPage() {
  const [me, setMe] = useState<any>(null);
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");

  const [slug, setSlug] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [msg, setMsg] = useState("");

  const { showToast } = useToast();

  // 当前登录用户
  useEffect(() => {
    (async () => {
      try {
        const d = await fetch("/api/me", {
          cache: "no-store",
        }).then((r) => r.json());
        setMe(d.user || null);
      } catch {
        setMe(null);
      }
    })().catch(() => {});
  }, []);

  // 检查后台提升状态
  useEffect(() => {
    if (!me || me.role !== "ADMIN") return;
    (async () => {
      try {
        const r = await fetch("/api/admin/status", {
          cache: "no-store",
        });
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

  async function load(nextPage = 1) {
    if (!elevated) return;
    setLoading(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "50");
      if (slug.trim()) params.set("slug", slug.trim());
      if (userId.trim()) {
        const idNum = Number(userId.trim());
        if (!Number.isNaN(idNum) && idNum > 0) {
          params.set("userId", String(idNum));
        }
      }
      const r = await fetch(
        "/api/admin/comments?" + params.toString(),
        { cache: "no-store" },
      );
      if (r.ok) {
        const d = await r.json();
        setComments(d.comments || []);
        setPage(d.page || nextPage);
        setHasMore(Boolean(d.hasMore));
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
      load(1);
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

  async function removeComment(c: AdminComment) {
    if (
      !window.confirm(
        `确定要删除该评论吗？（文章：${c.postSlug}，ID：${c.id}）`,
      )
    ) {
      return;
    }
    const r = await fetch(
      `/api/posts/${encodeURIComponent(
        c.postSlug,
      )}/comments?id=${c.id}`,
      { method: "DELETE" },
    );
    if (r.ok) {
      showToast("评论已删除", "success");
      load(page);
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

  // 封禁
  async function banUser(c: AdminComment) {
    if (!c.userId) {
      showToast("该评论没有绑定用户 ID，无法封禁用户", "info");
      return;
    }
    const minutesRaw = window.prompt(
      "封禁多久？单位：分钟（默认 60 分钟）",
    );
    // 用户点击“取消”时，prompt 返回 null，直接中断
    if (minutesRaw === null) {
      return;
    }
    const trimmed = minutesRaw.trim();
    let minutes = trimmed ? Number(trimmed) : 60;
    if (!Number.isFinite(minutes) || minutes <= 0) {
      showToast("请输入有效的封禁时长", "info");
      return;
    }
    const reason = window.prompt("封禁原因（可选）") || "";
    const r = await fetch("/api/admin/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: c.userId,
        minutes,
        reason: reason || undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("已封禁该用户的评论权限", "success");
      // 刷新当前页，确保 banned 状态和按钮同步
      load(page);
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或封禁失败", "error");
      }
    } else {
      showToast(d?.error || "封禁失败", "error");
    }
  }

  // 解除封禁
  async function unbanUser(c: AdminComment) {
    if (!c.userId) {
      showToast("该评论没有绑定用户 ID，无法解封用户评论权限", "info");
      return;
    }
    if (
      !window.confirm(
        `确定要解除用户 ID ${c.userId} 的评论封禁吗？`,
      )
    ) {
      return;
    }
    const r = await fetch("/api/admin/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "unban",
        userId: c.userId,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("已解除该用户的评论封禁", "success");
      // 刷新当前页，确保 banned 状态和按钮同步
      load(page);
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或解封失败", "error");
      }
    } else {
      showToast(d?.error || "解封失败", "error");
    }
  }

  useEffect(() => {
    if (me?.role === "ADMIN" && elevated) {
      load(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, elevated]);

  if (!me) return null;
  if (me.role !== "ADMIN") {
    return (
      <div className="container">
        <div className="card">无权限访问该页面</div>
      </div>
    );
  }

  return (
    <div className="container">
      <section className="section">
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>
            评论审核 / 封禁
          </div>

          <div
            style={{
              fontSize: 14,
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>
              当前账号：
              <span style={{ fontWeight: 500 }}>
                {me.name || me.email || `管理员#${me.id}`}
              </span>
            </span>
            <span>
              安全状态：
              <span
                style={{
                  fontWeight: 500,
                  color: elevated ? "#4caf50" : "#f97316",
                }}
              >
                {elevated ? "已验证" : "未验证"}
              </span>
            </span>
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
                完成验证后才能查看与管理评论（默认操作码 123456，可在
                .env 中配置 ADMIN_OP_CODE）
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
            <input
              placeholder="按文章 slug 筛选（可选）"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load(1);
                }
              }}
              style={{
                flex: "1 1 160px",
                minWidth: 0,
                padding: "6px 8px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--text)",
              }}
              disabled={!elevated}
            />
            <input
              placeholder="按用户 ID 筛选（可选）"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load(1);
                }
              }}
              style={{
                flex: "0 0 130px",
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
              onClick={() => load(1)}
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
              {!comments.length && !loading && (
                <div className="hint">当前条件下暂无评论</div>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
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
                        fontSize: 14,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      文章：
                      <a
                        href={`/post/${encodeURIComponent(
                          c.postSlug,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--link)" }}
                      >
                        {c.postSlug}
                      </a>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        flexShrink: 0,
                      }}
                    >
                      评论 ID：{c.id}
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
                      用户：
                      {c.user
                        ? c.user.name ||
                          c.user.email ||
                          `#${c.user.id}`
                        : c.guestName || "访客"}
                    </span>
                    {c.userId && (
                      <span>用户 ID：{c.userId}</span>
                    )}
                    <span>
                      时间：
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                    title={c.content}
                  >
                    {c.content}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="nav-link"
                      onClick={() => removeComment(c)}
                      style={{ cursor: "pointer" }}
                    >
                      删除评论
                    </button>
                    {c.userId && !c.banned && (
                      <button
                        type="button"
                        className="nav-link"
                        onClick={() => banUser(c)}
                        style={{ cursor: "pointer" }}
                      >
                        封禁该用户评论
                      </button>
                    )}
                    {c.userId && c.banned && (
                      <button
                        type="button"
                        className="nav-link"
                        onClick={() => unbanUser(c)}
                        style={{ cursor: "pointer" }}
                      >
                        解除该用户评论封禁
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="hint">加载中，请稍候…</div>
              )}
              {comments.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <button
                    type="button"
                    className="nav-link"
                    disabled={page <= 1 || loading}
                    onClick={() => load(Math.max(1, page - 1))}
                    style={{
                      cursor:
                        page <= 1 || loading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    上一页
                  </button>
                  <span className="hint">
                    第 {page} 页
                    {hasMore ? "（还有更多…）" : "（已到末尾）"}
                  </span>
                  <button
                    type="button"
                    className="nav-link"
                    disabled={!hasMore || loading}
                    onClick={() => load(page + 1)}
                    style={{
                      cursor:
                        !hasMore || loading
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}

          {!elevated && !checkingElevated && (
            <div className="hint">
              请先完成后台安全验证后，再查看与管理评论。
            </div>
          )}

          {msg && <div className="hint">{msg}</div>}
        </div>
      </section>
    </div>
  );
}

