"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "./ToastProvider";

type TopbarProps = {
  siteTitle?: string;
  subtitle?: string | null;
};

export default function Topbar({ siteTitle, subtitle }: TopbarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch(() => {});
  }, []);

  const isGuestOrAnon = !me || me.role === "GUEST";

  const onAuthRequired = (e: any) => {
    e.preventDefault();
    showToast("注册/登录后再使用这些功能哦~", "info");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    location.reload();
  };

  return (
    <header className="topbar">
      <div
        className="brand"
        onClick={() => {
          location.href = "/";
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            overflow: "hidden",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/blogicon.png"
            alt="站点图标"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </span>
        <span>
          {siteTitle || "MaruBlog"}
          {subtitle ? (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      </div>
      <nav className="nav">
        <Link
          className={`nav-link ${isActive("/") ? "active" : ""}`}
          href="/"
          aria-current={isActive("/") ? "page" : undefined}
        >
          首页
        </Link>
        <Link
          className={`nav-link ${
            isActive("/discover") ? "active" : ""
          }`}
          href="/discover"
        >
          发现
        </Link>
        {isGuestOrAnon ? (
          <button
            type="button"
            className="nav-link disabled"
            onClick={onAuthRequired}
            title="注册/登录后再使用这些功能哦~"
            style={{ backgroundColor: "transparent", fontSize: "16px" }}
          >
            草稿
          </button>
        ) : (
          <Link
            className={`nav-link ${
              isActive("/drafts") ? "active" : ""
            }`}
            href="/drafts"
          >
            草稿
          </Link>
        )}
        <Link
          className={`nav-link ${
            isActive("/settings") ? "active" : ""
          }`}
          href="/settings"
        >
          设置
        </Link>
        {isGuestOrAnon ? (
          <button
            type="button"
            className="nav-link disabled"
            onClick={onAuthRequired}
            title="注册/登录后再使用这些功能哦~"
            style={{ backgroundColor: "transparent", fontSize: "16px" }}
          >
            新建
          </button>
        ) : (
          <Link
            className={`nav-link ${
              isActive("/new") ? "active" : ""
            }`}
            href="/new"
          >
            新建
          </Link>
        )}
        {!me ? (
          <Link
            className={`nav-link ${
              isActive("/login") ? "active" : ""
            }`}
            href="/login"
          >
            登录
          </Link>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              className="nav-link"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px",
                cursor: "pointer",
                backgroundColor: "transparent",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid var(--brand)",
                  background:
                    "linear-gradient(135deg,rgba(95,179,243,.25),rgba(159,122,234,.25))",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {me?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={me.avatar}
                    alt="头像"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  <span style={{ fontWeight: 700 }}>
                    {(me?.name || "名").slice(0, 1)}
                  </span>
                )}
              </span>
            </button>
            {open && (
              <div
                className="avatar-menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 6,
                  minWidth: 120,
                }}
                role="menu"
              >
                {me?.name ? (
                  <button
                    className="nav-link"
                    type="button"
                    role="menuitem"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      marginBottom: "5px",
                    }}
                    onClick={() => {
                      location.href = `/user/${encodeURIComponent(
                        me.name,
                      )}`;
                    }}
                  >
                    个人主页
                  </button>
                ) : (
                  <button
                    className="nav-link"
                    type="button"
                    role="menuitem"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      location.href = "/settings";
                    }}
                  >
                    完善资料
                  </button>
                )}

                <button
                  className="nav-link"
                  onClick={logout}
                  role="menuitem"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  退出
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
