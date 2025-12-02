"use client";
import { useEffect, useState } from "react";
import AvatarCropper from "../components/AvatarCropper";
import { useToast } from "../components/ToastProvider";
import { getLevelBadge } from "@/lib/userLevel";

// 昵称校验：长度按英文计 3~30，1 个中文按 2 个英文计
function validateNickname(n: string) {
  const str = (n || "").trim();
  if (!str) return false;
  const chinese = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (str.match(/[A-Za-z0-9]/g) || []).length;
  const total = english + chinese * 2;
  return total >= 3 && total <= 30;
}

export default function UserProfileCard() {
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [msg, setMsg] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      const d = await fetch("/api/me", {
        cache: "no-store",
      }).then((r) => r.json());
      setMe(d.user);
      setName(d.user?.name || "");
      setAvatar(d.user?.avatar || "");
      setSignature(d.user?.signature || "");
    })().catch(() => {});
  }, []);

  async function save() {
    if (me?.role === "GUEST") {
      setMsg("访客不可修改头像或签名");
      return;
    }
    if (name && !validateNickname(name)) {
      setMsg(
        "昵称长度需 3~30 个英文字符（1 个中文按 2 个英文计）",
      );
      return;
    }
    setMsg("保存中...");
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar, signature }),
    });
    if (res.ok) {
      const d = await res.json();
      setMe(d.user);
      setEditing(false);
      setMsg("已保存");
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(err?.error || "保存失败");
    }
  }

  if (!me)
    return (
      <div
        className="card"
        style={{ display: "flex", gap: 16, alignItems: "center" }}
      >
        <div className="avatar-circle" aria-label="用户头像">
          头像
        </div>
        <div style={{ color: "var(--muted)" }}>未登录</div>
      </div>
    );

  const isGuest = me?.role === "GUEST";
  const isAdmin = me?.role === "ADMIN";
  const badge = getLevelBadge(me?.role, me?.level);

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="avatar-circle" aria-label="用户头像">
            {me.avatar ? (
              <img
                src={me.avatar?.startsWith("/uploads/") ? `/api${me.avatar}` : me.avatar}
                alt="头像"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              (me.name || "未命名").slice(0, 1)
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {me.name || "未命名"}
              </div>
              {/* 访客/匿名用户不显示等级徽章 */}
              {badge && (
                <>
                  <a
                    href="/levels"
                    className="user-level"
                    style={{
                      borderColor: badge.color,
                      color: badge.color,
                      background: badge.bg,
                      textDecoration: "none",
                    }}
                  >
                    {badge.text}
                  </a>
                  {badge.extraTag && (
                    <span className="user-level">
                      {badge.extraTag}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="user-sign">
              {isGuest
                ? me.signature || null
                : me.signature || "你还没有个性签名呀~"}
            </div>
          </div>
        </div>
        {open && (
          <div style={{ display: "grid", gap: 10 }}>
            {!editing ? (
              <div style={{ display: "flex", gap: 8 }}>
                {!isGuest && (
                  <button
                    className="nav-link"
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditing(true)}
                  >
                    编辑个人信息
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                }}
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="昵称"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "transparent",
                    color: "var(--text)",
                  }}
                  disabled={isGuest}
                />
                <input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="个性签名（可选）"
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "transparent",
                    color: "var(--text)",
                  }}
                  disabled={isGuest}
                />
                {!isGuest && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setFileToCrop(f);
                      setCropOpen(true);
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {!isGuest && (
                    <button
                      className="nav-link"
                      onClick={save}
                      style={{ cursor: "pointer" }}
                    >
                      保存
                    </button>
                  )}
                  <button
                    className="nav-link"
                    onClick={() => {
                      setEditing(false);
                      setName(me.name || "");
                      setAvatar(me.avatar || "");
                      setSignature(me.signature || "");
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    取消
                  </button>
                  {!isAdmin && (
                    <button
                      type="button"
                      className="nav-link"
                      onClick={async () => {
                        const label =
                          me.name || me.email || `用户#${me.id}`;
                        const input = window.prompt(
                          `要删除账号「${label}」，请输入该用户名以确认（此操作不可恢复）：`,
                          "",
                        );
                        if (input === null) return;
                        if ((input || "").trim() !== (me.name || "")) {
                          showToast(
                            "输入的用户名不匹配，已取消删除",
                            "info",
                          );
                          return;
                        }
                        const ok = window.confirm(
                          "再次确认：确定要删除你的账号以及所有相关数据吗？此操作不可恢复！",
                        );
                        if (!ok) return;
                        const res = await fetch("/api/me", {
                          method: "DELETE",
                        });
                        const d = await res
                          .json()
                          .catch(() => ({}));
                        if (res.ok) {
                          showToast("账号已删除", "success");
                          location.href = "/";
                        } else if (
                          d?.error === "cannot_delete_admin"
                        ) {
                          showToast(
                            "管理员账号不能被删除",
                            "error",
                          );
                        } else {
                          showToast(
                            d?.error || "删除失败",
                            "error",
                          );
                        }
                      }}
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
                  {msg && <span className="hint">{msg}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AvatarCropper
        open={cropOpen}
        file={fileToCrop}
        onClose={() => {
          setCropOpen(false);
          setFileToCrop(null);
        }}
        onCropped={async (blob) => {
          try {
            const fd = new FormData();
            const f = new File([blob], "avatar.jpg", {
              type: "image/jpeg",
            });
            fd.append("file", f);
            const r = await fetch("/api/upload?kind=avatar", {
              method: "POST",
              body: fd,
            });
            const d = await r.json();
            if (r.ok) {
              setAvatar(d.upload.url);
              setMsg("头像已上传");
              showToast("头像已上传", "success");
            } else {
              const m = d.error || "上传失败";
              setMsg(m);
              showToast(m, "error");
            }
          } finally {
            setCropOpen(false);
            setFileToCrop(null);
          }
        }}
      />
    </>
  );
}
