"use client";
import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type AdminUser = {
  id: number;
  name?: string;
  email?: string;
  role: "ADMIN" | "AUTHOR" | "GUEST";
  createdAt: string;
  stats?: { date: string; postsToday?: number; xpToday?: number } | null;
  ban?: { until: string; reason?: string; permanent?: boolean } | null;
};

export default function AdminUsersPage() {
  const [me, setMe] = useState<any>(null);
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [msg, setMsg] = useState("");

  const { showToast } = useToast();

  // 当前用户
  useEffect(() => {
    (async () => {
      try {
        const d = await fetch("/api/me", { cache: "no-store" }).then(
          (r) => r.json(),
        );
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
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(
        "/api/admin/users?" + params.toString(),
        { cache: "no-store" },
      );
      if (r.ok) {
        const d = await r.json();
        setUsers(d.users || []);
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

  async function banUser(u: AdminUser) {
    if (u.role === "ADMIN") {
      showToast("管理员账号不能被封禁", "info");
      return;
    }
    const minutesRaw = window.prompt(
      "封禁多久？单位：分钟（留空为永久封禁，默认 60 分钟）",
      "60",
    );
    if (minutesRaw === null) {
      // 用户点击“取消”，不进行任何操作
      return;
    }
    const trimmed = minutesRaw.trim();
    let minutes: number | undefined;
    if (trimmed === "") {
      minutes = undefined; // 永久封禁
    } else {
      const v = Number(trimmed);
      if (!Number.isFinite(v) || v <= 0) {
        showToast("请输入有效的封禁时长，或留空表示永久封禁", "info");
        return;
      }
      minutes = v;
    }
    const reasonRaw = window.prompt(
      "封禁原因（可选，例如：异常行为）",
      "异常行为",
    );
    const reason = reasonRaw === null ? "" : reasonRaw.trim();
    const r = await fetch("/api/admin/users/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: u.id,
        minutes,
        reason: reason || undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("已封禁该用户", "success");
      load(page);
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或封禁失败", "error");
      }
    } else if (d?.error === "cannot_ban_admin") {
      showToast("管理员账号不能被封禁", "info");
    } else if (d?.error === "invalid_minutes") {
      showToast("封禁时长不合法，请重新输入", "info");
    } else {
      showToast(d?.error || "封禁失败", "error");
    }
  }

  async function unbanUser(u: AdminUser) {
    const r = await fetch("/api/admin/users/unban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("已解除该用户封禁", "success");
      load(page);
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或操作失败", "error");
      }
    } else {
      showToast(d?.error || "操作失败", "error");
    }
  }

  async function deleteUser(u: AdminUser) {
    if (u.role === "ADMIN") {
      showToast("管理员账号不能被删除", "info");
      return;
    }
    const label = u.name || u.email || `用户#${u.id}`;
    const ok1 = window.confirm(
      `确定要删除用户「${label}」的所有数据吗？此操作不可恢复！`,
    );
    if (!ok1) return;
    const ok2 = window.confirm("再次确认：确定要永久删除该用户数据吗？");
    if (!ok2) return;
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "DELETE",
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("已删除该用户及其相关数据", "success");
      load(page);
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或删除失败", "error");
      }
    } else if (d?.error === "cannot_delete_admin") {
      showToast("管理员账号不能被删除", "info");
    } else {
      showToast(d?.error || "删除失败", "error");
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
          <div style={{ fontWeight: 600, fontSize: 18 }}>用户列表 / 封禁</div>

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
                完成验证后才能查看与封禁用户（默认操作码为 123456，可在
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
            <input
              placeholder="按 ID / 名称 / 邮箱搜索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  load(1);
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
              {!users.length && !loading && (
                <div className="hint">当前条件下暂无用户</div>
              )}
              {users.map((u) => {
                const banned = Boolean(u.ban);
                const isPermanent = !!u.ban?.permanent;
                const untilLocal =
                  u.ban && u.ban.until && !isPermanent
                    ? new Date(u.ban.until).toLocaleString()
                    : "";
                return (
                  <div
                    key={u.id}
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
                      >
                        {u.name || u.email || `用户#${u.id}`}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          flexShrink: 0,
                        }}
                      >
                        ID：{u.id} · 角色：{u.role}
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
                        创建时间：
                        {new Date(
                          u.createdAt,
                        ).toLocaleString()}
                      </span>
                      {u.stats?.postsToday !== undefined && (
                        <span>今日发文：{u.stats.postsToday}</span>
                      )}
                      {u.stats?.xpToday !== undefined && (
                        <span>今日经验：{u.stats.xpToday}</span>
                      )}
                      {banned && (
                        <span style={{ color: "#f97316" }}>
                          {isPermanent
                            ? "已永久封禁"
                            : `已封禁，解禁时间：${untilLocal}`}
                        </span>
                      )}
                      {banned && u.ban?.reason && (
                        <span>原因：{u.ban.reason}</span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {!banned && (
                        <button
                          type="button"
                          className="nav-link"
                          onClick={() => banUser(u)}
                          style={{ cursor: "pointer" }}
                        >
                          封禁
                        </button>
                      )}
                      {banned && (
                        <button
                          type="button"
                          className="nav-link"
                          onClick={() => unbanUser(u)}
                          style={{ cursor: "pointer" }}
                        >
                          解除封禁
                        </button>
                      )}
                      {u.role !== "ADMIN" && (
                        <button
                          type="button"
                          className="nav-link"
                          onClick={() => deleteUser(u)}
                          style={{
                            cursor: "pointer",
                            backgroundColor: "#7f1d1d",
                            color: "#fee2e2",
                            borderColor: "rgba(248,113,113,.6)",
                          }}
                        >
                          删除用户数据
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="hint">加载中，请稍候…</div>
              )}
              {users.length > 0 && (
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
              请先完成后台安全验证后，再查看与封禁用户。
            </div>
          )}

          {msg && <div className="hint">{msg}</div>}
        </div>
      </section>
    </div>
  );
}
