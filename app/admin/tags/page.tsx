"use client";
import { useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";

type AdminTag = {
  id: number;
  name: string;
  color: string;
  bg: string;
  border: string;
  hidden: boolean;
  count: number;
};

// 将数据库中的颜色值转换为 <input type="color"> 可用的十六进制格式
function normalizeColorForPicker(value: string | null | undefined, fallbackHex: string): string {
  const v = (value || "").trim();
  if (!v) return fallbackHex;
  // 已经是十六进制
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
  // rgba / rgb 转 hex（忽略 alpha，只取 RGB 分量）
  const m = v.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const r = Math.max(0, Math.min(255, Number(m[1] || 0)));
    const g = Math.max(0, Math.min(255, Number(m[2] || 0)));
    const b = Math.max(0, Math.min(255, Number(m[3] || 0)));
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return fallbackHex;
}

export default function AdminTagsPage() {
  const [me, setMe] = useState<any>(null);
  const [elevated, setElevated] = useState(false);
  const [checkingElevated, setCheckingElevated] = useState(true);
  const [code, setCode] = useState("");

  const [tags, setTags] = useState<AdminTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#ffffff");
  const [newBg, setNewBg] = useState("#1f2937");
  const [newBorder, setNewBorder] = useState("#4b5563");

  const [mergeSourceId, setMergeSourceId] = useState<number | "">("");
  const [mergeTargetId, setMergeTargetId] = useState<number | "">("");

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

  async function load() {
    if (!elevated) return;
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/admin/tags", {
        cache: "no-store",
      });
      if (r.ok) {
        const d = await r.json();
        setTags(d.tags || []);
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

  // 新增标签
  async function createTag() {
    const name = newName.trim();
    if (!name) {
      showToast("请输入标签名称", "info");
      return;
    }
    const r = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        color: newColor,
        bg: newBg,
        border: newBorder,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("已新增标签", "success");
      setNewName("");
      load();
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或操作失败", "error");
      }
    } else if (d?.error === "duplicate") {
      showToast("已存在同名标签", "info");
    } else {
      showToast(d?.error || "新增标签失败", "error");
    }
  }

  // 更新单个标签（名称/颜色/隐藏）
  async function updateTag(id: number, patch: Partial<AdminTag>) {
    const r = await fetch(`/api/admin/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("标签已更新", "success");
      load();
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或操作失败", "error");
      }
    } else if (d?.error === "duplicate") {
      showToast("已存在同名标签", "info");
    } else {
      showToast(d?.error || "更新失败", "error");
    }
  }

  // 删除标签
  async function deleteTag(id: number, name: string) {
    const ok = window.confirm(
      `确定要删除标签「${name}」吗？将会从所有文章中移除此标签。`,
    );
    if (!ok) return;
    const r = await fetch(`/api/admin/tags/${id}`, {
      method: "DELETE",
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("标签已删除", "success");
      load();
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或删除失败", "error");
      }
    } else {
      showToast(d?.error || "删除失败", "error");
    }
  }

  // 合并标签
  async function mergeTags() {
    if (!mergeSourceId || !mergeTargetId) {
      showToast("请选择要合并的源标签和目标标签", "info");
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      showToast("源标签和目标标签不能相同", "info");
      return;
    }
    const source = tags.find((t) => t.id === mergeSourceId);
    const target = tags.find((t) => t.id === mergeTargetId);
    if (!source || !target) {
      showToast("所选标签不存在", "error");
      return;
    }
    const ok = window.confirm(
      `确定要将标签「${source.name}」合并到「${target.name}」吗？此操作会修改所有文章的标签。`,
    );
    if (!ok) return;
    const r = await fetch("/api/admin/tags/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: mergeSourceId,
        targetId: mergeTargetId,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast("合并完成", "success");
      setMergeSourceId("");
      setMergeTargetId("");
      load();
    } else if (r.status === 403) {
      if (d?.error === "elevation_required") {
        setElevated(false);
        showToast("安全验证已失效，请重新输入管理操作码", "info");
      } else {
        showToast("无权限或合并失败", "error");
      }
    } else {
      showToast(d?.error || "合并失败", "error");
    }
  }

  useEffect(() => {
    if (me?.role === "ADMIN" && elevated) {
      load();
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
            标签管理
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
                完成验证后才能管理标签（默认操作码为 123456，可在
                .env 中配置 ADMIN_OP_CODE）。
              </span>
            </div>
          )}

          {/* 新增标签 */}
          <div
            className="card"
            style={{ display: "grid", gap: 8, marginTop: 4 }}
          >
            <div style={{ fontWeight: 500 }}>新增标签</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                placeholder="标签名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
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
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="hint">文字</span>
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  disabled={!elevated}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="hint">背景</span>
                <input
                  type="color"
                  value={newBg}
                  onChange={(e) => setNewBg(e.target.value)}
                  disabled={!elevated}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="hint">边框</span>
                <input
                  type="color"
                  value={newBorder}
                  onChange={(e) => setNewBorder(e.target.value)}
                  disabled={!elevated}
                />
              </label>
              <button
                type="button"
                className="nav-link"
                onClick={createTag}
                disabled={!elevated}
                style={{
                  cursor: elevated ? "pointer" : "not-allowed",
                }}
              >
                新增
              </button>
            </div>
          </div>

          {/* 合并标签 */}
          <div
            className="card"
            style={{ display: "grid", gap: 8, marginTop: 4 }}
          >
            <div style={{ fontWeight: 500 }}>合并标签</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <select
                value={mergeSourceId === "" ? "" : String(mergeSourceId)}
                onChange={(e) =>
                  setMergeSourceId(
                    e.target.value
                      ? Number(e.target.value)
                      : "",
                  )
                }
                disabled={!elevated}
              >
                <option value="">选择源标签</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="hint">合并到</span>
              <select
                value={mergeTargetId === "" ? "" : String(mergeTargetId)}
                onChange={(e) =>
                  setMergeTargetId(
                    e.target.value
                      ? Number(e.target.value)
                      : "",
                  )
                }
                disabled={!elevated}
              >
                <option value="">选择目标标签</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="nav-link"
                onClick={mergeTags}
                disabled={!elevated}
                style={{
                  cursor: elevated ? "pointer" : "not-allowed",
                }}
              >
                合并
              </button>
            </div>
          </div>

          {/* 标签列表 */}
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
              {!tags.length && !loading && (
                <div className="hint">暂无标签</div>
              )}
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="card"
                  style={{
                    padding: 10,
                    display: "grid",
                    gap: 6,
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
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={t.name}
                      >
                        {t.name}
                      </div>
                      <span
                        className="badge tag"
                        style={{
                          background: t.bg || "rgba(128,128,128,.15)",
                          color: t.color || "#bbb",
                          borderColor:
                            t.border || "rgba(128,128,128,.25)",
                        }}
                      >
                        # {t.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        flexShrink: 0,
                      }}
                    >
                      文章数：{t.count}{" "}
                      {t.hidden && (
                        <span style={{ marginLeft: 4, color: "#f97316" }}>
                          （已隐藏）
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      defaultValue={t.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== t.name) {
                          updateTag(t.id, { name: v } as any);
                        } else {
                          e.target.value = t.name;
                        }
                      }}
                      style={{
                        padding: "4px 6px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--text)",
                        minWidth: 80,
                      }}
                      disabled={!elevated}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="hint">文字</span>
                      <input
                        type="color"
                        defaultValue={normalizeColorForPicker(
                          t.color,
                          "#ffffff",
                        )}
                        onBlur={(e) =>
                          updateTag(t.id, { color: e.target.value } as any)
                        }
                        disabled={!elevated}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="hint">背景</span>
                      <input
                        type="color"
                        defaultValue={normalizeColorForPicker(
                          t.bg,
                          "#1f2937",
                        )}
                        onBlur={(e) =>
                          updateTag(t.id, { bg: e.target.value } as any)
                        }
                        disabled={!elevated}
                      />
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="hint">边框</span>
                      <input
                        type="color"
                        defaultValue={normalizeColorForPicker(
                          t.border,
                          "#4b5563",
                        )}
                        onBlur={(e) =>
                          updateTag(t.id, { border: e.target.value } as any)
                        }
                        disabled={!elevated}
                      />
                    </label>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 4,
                    }}
                  >
                    <button
                      type="button"
                      className="nav-link"
                      onClick={() =>
                        updateTag(t.id, { hidden: !t.hidden } as any)
                      }
                      disabled={!elevated}
                      style={{ cursor: elevated ? "pointer" : "not-allowed" }}
                    >
                      {t.hidden ? "取消隐藏" : "隐藏标签"}
                    </button>
                    <button
                      type="button"
                      className="nav-link"
                      onClick={() => deleteTag(t.id, t.name)}
                      disabled={!elevated}
                      style={{
                        cursor: elevated ? "pointer" : "not-allowed",
                        backgroundColor: "#7f1d1d",
                        color: "#fee2e2",
                        borderColor: "rgba(248,113,113,.6)",
                      }}
                    >
                      删除标签
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
              请先完成后台安全验证后，再管理标签。
            </div>
          )}

          {msg && <div className="hint">{msg}</div>}
        </div>
      </section>
    </div>
  );
}
