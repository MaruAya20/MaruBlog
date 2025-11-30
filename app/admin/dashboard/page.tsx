"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type DashboardSummary = {
  pv: number;
  uv: number;
  favorites: number;
  comments: number;
  favRate: number;
  commentRate: number;
};

type DashboardPost = {
  slug: string;
  title: string;
  pv: number;
  uv: number;
  likes: number;
  favorites: number;
  comments: number;
  favRate: number;
  commentRate: number;
};

export default function AdminDashboardPage() {
  const [me, setMe] = useState<any>(null);
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");

  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topPosts, setTopPosts] = useState<DashboardPost[]>([]);
  const [loading, setLoading] = useState(false);

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

  async function load(rangeDays = days) {
    if (!elevated) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("days", String(rangeDays));
      const r = await fetch(`/api/admin/dashboard?${params.toString()}`, {
        cache: "no-store",
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setDays(d.days || rangeDays);
        setSummary(d.summary || null);
        setTopPosts(d.topPosts || []);
      } else if (r.status === 403) {
        if (d?.error === "elevation_required") {
          setElevated(false);
          showToast("安全验证已失效，请重新输入管理操作码", "info");
        } else {
          showToast("无权限或加载失败", "error");
        }
      } else {
        showToast(d?.error || "加载仪表盘数据失败", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  // 首次加载
  useEffect(() => {
    if (me?.role === "ADMIN" && elevated) {
      load().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, elevated]);

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
      showToast("已通过后台安全验证", "success");
      load().catch(() => {});
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
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>站点仪表盘</div>
          <div className="hint">
            概览最近一段时间内的 PV/UV、热门文章榜单，以及简单的收藏率、评论量等指标。
          </div>

          {/* 安全状态与验证 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 14 }}>
              安全状态：
              <span
                style={{
                  fontWeight: 500,
                  color: elevated ? "#4caf50" : "#f97316",
                }}
              >
                {checkingElevated
                  ? "检测中..."
                  : elevated
                    ? "已通过管理操作验证"
                    : "未验证"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="输入管理操作码"
                style={{
                  padding: "4px 6px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "transparent",
                  color: "var(--text)",
                  minWidth: 160,
                }}
              />
              <button
                type="button"
                className="nav-link"
                onClick={verify}
                style={{ cursor: "pointer" }}
              >
                提交验证
              </button>
            </div>
          </div>

          {!elevated && !checkingElevated && (
            <div className="hint">
              请先完成后台安全验证后，再查看仪表盘数据。
            </div>
          )}

          {elevated && (
            <div
              style={{
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 8,
                display: "grid",
                gap: 12,
              }}
            >
              {/* 时间范围选择 */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span className="hint">统计时间范围：</span>
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="nav-link"
                    onClick={() => load(d)}
                    style={{
                      cursor: "pointer",
                      opacity: days === d ? 1 : 0.7,
                    }}
                  >
                    最近 {d} 天
                  </button>
                ))}
                {loading && (
                  <span className="hint">加载中...</span>
                )}
              </div>

              {/* PV/UV 和整体转化 */}
              {summary && (
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(160px,1fr))",
                  }}
                >
                  <div className="card" style={{ padding: 8 }}>
                    <div className="hint">总 PV</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>
                      {summary.pv}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 8 }}>
                    <div className="hint">总 UV</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>
                      {summary.uv}
                    </div>
                  </div>
                  <div className="card" style={{ padding: 8 }}>
                    <div className="hint">收藏总数 / 收藏率</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {summary.favorites}{" "}
                      <span className="hint">
                        （{(summary.favRate * 100).toFixed(1)}%）
                      </span>
                    </div>
                  </div>
                  <div className="card" style={{ padding: 8 }}>
                    <div className="hint">评论总数 / 评论率</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {summary.comments}{" "}
                      <span className="hint">
                        （{(summary.commentRate * 100).toFixed(1)}%）
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 热门文章榜单 */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  热门文章榜单（按 PV 排名前 10）
                </div>
                {!topPosts.length && (
                  <div className="hint">暂时还没有统计数据</div>
                )}
                {!!topPosts.length && (
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {topPosts.map((p, idx) => (
                      <div
                        key={p.slug}
                        className="card"
                        style={{
                          padding: 8,
                          display: "grid",
                          gridTemplateColumns:
                            "auto 1fr auto",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            minWidth: 24,
                            textAlign: "center",
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ overflow: "hidden" }}>
                          <a
                            href={`/post/${encodeURIComponent(p.slug)}`}
                            className="nav-link"
                            style={{
                              padding: 0,
                              background: "transparent",
                              border: "none",
                              textAlign: "left",
                              width: "100%",
                              cursor: "pointer",
                              fontWeight: 500,
                              display: "inline-block",
                              maxWidth: "100%",
                              whiteSpace: "nowrap",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              color:"#35cfcfeb"
                            }}
                          >
                            {p.title || p.slug}
                          </a>
                          <div
                            className="hint"
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              fontSize: 12,
                            }}
                          >
                            <span>PV：{p.pv}</span>
                            <span>UV：{p.uv}</span>
                            <span>赞：{p.likes}</span>
                            <span>收藏：{p.favorites}</span>
                            <span>评论：{p.comments}</span>
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: "right",
                            fontSize: 12,
                            color: "var(--muted)",
                          }}
                        >
                          <div>
                            收藏率：
                            {(p.favRate * 100).toFixed(1)}%
                          </div>
                          <div>
                            评论率：
                            {(p.commentRate * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

