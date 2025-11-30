"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type SiteSettings = {
  title: string;
  subtitle?: string;
  seoDescription?: string;
  announcement?: string;
  allowGuestComment: boolean;
  allowRegistration: boolean;
};

export default function AdminSettingsPage() {
  const [me, setMe] = useState<any>(null);
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");

  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();

  // 当前用户
  useEffect(() => {
    (async () => {
      try {
        const d = await fetch("/api/me", { cache: "no-store" }).then((r) =>
          r.json(),
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

  async function load() {
    if (!elevated) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/settings", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setSettings(d.settings as SiteSettings);
      } else if (r.status === 403) {
        const d = await r.json().catch(() => ({}));
        if (d?.error === "elevation_required") {
          setElevated(false);
          showToast("安全验证已失效，请重新输入管理操作码", "info");
        } else {
          showToast("无权限或加载失败", "error");
        }
      } else {
        showToast("加载失败", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  // 首次加载设置
  useEffect(() => {
    if (me?.role === "ADMIN" && elevated) {
      load();
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

  async function save() {
    if (!settings) return;
    const payload: SiteSettings = {
      title: settings.title?.trim() || "",
      subtitle: settings.subtitle?.trim() || "",
      seoDescription: settings.seoDescription?.trim() || "",
      announcement: settings.announcement?.trim() || "",
      allowGuestComment: settings.allowGuestComment,
      allowRegistration: settings.allowRegistration,
    };
    if (!payload.title) {
      showToast("站点标题不能为空", "info");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setSettings(d.settings as SiteSettings);
        showToast("站点设置已保存", "success");
      } else if (r.status === 403) {
        if (d?.error === "elevation_required") {
          setElevated(false);
          showToast("安全验证已失效，请重新输入管理操作码", "info");
        } else {
          showToast("无权限或保存失败", "error");
        }
      } else {
        showToast(d?.error || "保存失败", "error");
      }
    } finally {
      setLoading(false);
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
          <div style={{ fontWeight: 600, fontSize: 18 }}>站点设置</div>
          <div className="hint">
            在这里可以配置站点标题、SEO 描述、公告，以及是否允许访客评论、是否开放注册等。
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
              请先完成后台安全验证后，再编辑站点设置。
            </div>
          )}

          {elevated && (
            <div
              style={{
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 8,
                display: "grid",
                gap: 10,
              }}
            >
              {!settings && (
                <div className="hint">
                  {loading ? "加载中..." : "暂无站点设置，保存后自动创建。"}
                </div>
              )}

              {settings && (
                <>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 14, fontWeight: 500 }}>
                      站点标题
                    </label>
                    <input
                      value={settings.title}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          title: e.target.value,
                        })
                      }
                      placeholder="例如：MaruBlog"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--text)",
                      }}
                    />
                    <div className="hint">用于顶部导航和浏览器标题。</div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 14, fontWeight: 500 }}>
                      副标题
                    </label>
                    <input
                      value={settings.subtitle || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          subtitle: e.target.value,
                        })
                      }
                      placeholder="一句话介绍你的站点"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--text)",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 14, fontWeight: 500 }}>
                      SEO 描述
                    </label>
                    <textarea
                      value={settings.seoDescription || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          seoDescription: e.target.value,
                        })
                      }
                      placeholder="用于搜索引擎摘要的简短描述，建议不超过 200 字。"
                      rows={3}
                      style={{
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--text)",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 14, fontWeight: 500 }}>
                      站点公告
                    </label>
                    <textarea
                      value={settings.announcement || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          announcement: e.target.value,
                        })
                      }
                      placeholder="用于在前台展示的重要公告、维护信息等。"
                      rows={3}
                      style={{
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--text)",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settings.allowGuestComment}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            allowGuestComment: e.target.checked,
                          })
                        }
                      />
                      <span>允许未登录访客发表评论</span>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settings.allowRegistration}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            allowRegistration: e.target.checked,
                          })
                        }
                      />
                      <span>开放注册（允许通过邮箱等方式创建新账号）</span>
                    </label>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <button
                      type="button"
                      className="nav-link"
                      onClick={save}
                      disabled={loading}
                      style={{
                        cursor: loading ? "wait" : "pointer",
                      }}
                    >
                      {loading ? "保存中..." : "保存设置"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

