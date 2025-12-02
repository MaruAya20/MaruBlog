import type { Metadata } from "next";
import "./globals.css";
import Topbar from "./components/Topbar";
import FloatingSidebar from "./components/FloatingSidebar";
import ToastProvider from "./components/ToastProvider";
import { cookies } from "next/headers";
import React from "react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsDb } from "@/lib/siteSettingsDb";

// 布局依赖用户会话 / DB 中的壁纸偏好，必须每次请求都重新计算，避免被静态缓存
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettingsDb();
  const title = settings.title || "MaruBlog";
  const desc =
    settings.seoDescription ||
    "SSR 博客原型，支持自定义壁纸、透明度和多种互动功能。";
  return {
    title,
    description: desc,
    icons: {
      icon: "/blogicon.png",
      shortcut: "/blogicon.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettingsDb();
  const store = await cookies();
  let wpUrl = store.get("wp_url")?.value || "";
  let wpOpacity = store.get("wp_opacity")?.value || "";

  const sess = await getSession();
  if (sess) {
    const pref = await prisma.userPreference.findUnique({
      where: { userId: sess.uid },
    });
    if (pref) {
      wpUrl = (pref.wallpaper as string | null) || "";
      if (typeof pref.opacity === "number") {
        wpOpacity = String(Math.min(1, Math.max(0, pref.opacity)));
      }
    } else {
      // 没有个人配置时，使用默认壁纸（globals.css 中的 wallpaper.jpg）
      wpUrl = "";
      wpOpacity = "";
    }
  } else {
    // 未登录 / 访客：忽略 cookie，统一使用默认壁纸
    wpUrl = "";
    wpOpacity = "";
  }

  // 兼容旧数据：如果 URL 以 /uploads/ 开头，统一转成 /api/uploads/ 前缀
  if (wpUrl && wpUrl.startsWith("/uploads/")) {
    wpUrl = "/api" + wpUrl;
  }

  const style: React.CSSProperties & Record<string, string> = {};
  if (wpUrl) style["--wallpaper-url"] = `url("${wpUrl}")`;
  if (wpOpacity) style["--wallpaper-opacity"] = String(wpOpacity);

  return (
    <html lang="zh-CN">
      <body className="antialiased" style={style}>
        <ToastProvider>
          <Topbar siteTitle={settings.title} subtitle={settings.subtitle} />
          {settings.announcement && (
            <div
              style={{
                width: "50%",
                margin: "0 auto",
                padding: "20px 12px 0",
              }}
            >
              <div
                className="card"
                style={{
                  padding: "6px 10px",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ marginRight: 4 }}>公告：</strong>
                <span>{settings.announcement}</span>
              </div>
            </div>
          )}
          {children}
          <FloatingSidebar />
        </ToastProvider>
      </body>
    </html>
  );
}

