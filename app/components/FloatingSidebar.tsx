"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "./ToastProvider";

type Me = {
  id: number;
  name?: string;
  role?: string;
  avatar?: string;
  xp?: number;
};

export default function FloatingSidebar() {
  const [me, setMe] = useState<Me | null>(null);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y =
        window.scrollY || document.documentElement.scrollTop || 0;
      setVisible(y > 120);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (href: string) => {
    router.push(href);
  };

  const requireMe = (fn: () => void) => {
    if (!me) {
      showToast("请先登录用户～", "info");
      return;
    }
    fn();
  };

  const entries = [
    // 从上往下的顺序：新建 -> 草稿 -> 发现 -> 我的 -> 设置 -> 头像
    {
      key: "avatar",
      label: me?.name ? me.name : "个人主页",
      icon: "",
      isAvatar: true,
      onClick: () =>
        requireMe(() => {
          const name = me?.name || "";
          if (name) {
            go(`/user/${encodeURIComponent(name)}`);
          } else {
            // 兜底：无昵称时仍跳用户主页列表
            go("/discover");
          }
        }),
    },
    {
      key: "settings",
      label: "设置",
      icon: "⚙",
      onClick: () => go("/settings"),
      active: pathname === "/settings",
    },
    {
      key: "mine",
      label: "我的界面",
      icon: "👤",
      onClick: () =>
        requireMe(() => {
          const name = me?.name || "";
          if (name) {
            go(`/user/${encodeURIComponent(name)}`);
          } else {
            showToast("请先完善个人资料～", "info");
          }
        }),
      active:
        pathname.startsWith("/user/") ||
        pathname === "/user",
    },
    {
      key: "discover",
      label: "发现",
      icon: "✨",
      onClick: () => go("/discover"),
      active: pathname === "/discover",
    },
    {
      key: "drafts",
      label: "草稿箱",
      icon: "📄",
      onClick: () =>
        requireMe(() => {
          go("/drafts");
        }),
      active: pathname === "/drafts",
    },
    {
      key: "new",
      label: "新建文章",
      icon: "✏",
      onClick: () =>
        requireMe(() => {
          if (me?.role === "GUEST") {
            showToast("访客无法新建文章", "info");
          } else {
            go("/new");
          }
        }),
      active: pathname === "/new",
    },
  ];

  return (
    <aside
      aria-label="侧边导航"
      style={{
        position: "fixed",
        left: 16,
        bottom: 24,
        zIndex: 40,
        pointerEvents: visible ? "auto" : "none",
        transform: visible
          ? "translate(0,0)"
          : "translate(-110%, 32px)",
        opacity: visible ? 1 : 0,
        transition:
          "transform .35s ease-out, opacity .35s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {entries.map((e) => {
          if (e.key === "new" && me && me.role === "GUEST") {
            // 访客隐藏新建按钮，仅通过提示引导
            return null;
          }
          const isActive = e.active;
          return (
            <NavItem
              key={e.key}
              label={e.label}
              icon={e.icon}
              isAvatar={e.isAvatar}
              me={me}
              active={isActive}
              onClick={e.onClick}
            />
          );
        })}
      </div>
    </aside>
  );
}

function levelFromXp(xp?: number) {
  const v = Math.max(0, xp || 0);
  let lvl = 1;
  for (let L = 1; L <= 10; L++) {
    const threshold = Math.round(1_000_000 * Math.pow(L / 10, 2));
    if (v >= threshold) lvl = L;
  }
  return lvl;
}

function NavItem({
  label,
  icon,
  isAvatar,
  me,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  isAvatar?: boolean;
  me: Me | null;
  active?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: active
            ? "2px solid var(--brand)"
            : "2px solid rgba(255,255,255,.5)",
          background: "#fff",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          padding: 0,
          boxShadow: active
            ? "0 0 0 3px rgba(95,179,243,.25)"
            : "0 8px 18px rgba(0,0,0,.35)",
        }}
      >
        {isAvatar ? (
          me?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.avatar}
              alt="头像"
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 700,
                fontSize: 22,
                color: "#111827",
              }}
            >
              {(me?.name || "名").slice(0, 1)}
            </span>
          )
        ) : (
          <span
            style={{
              fontSize: 24,
              lineHeight: 1,
              color: "#111827",
            }}
          >
            {icon}
          </span>
        )}
      </button>
      {hover && (
        <div
          className="sidebar-tooltip"
          style={{
            position: "absolute",
            left: 60,
            padding: "6px 12px",
            borderRadius: 10,
            background: "#ffffff",
            color: "#111827",
            fontSize: 13,
            whiteSpace: "nowrap",
            boxShadow: "0 12px 28px rgba(0,0,0,.25)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
