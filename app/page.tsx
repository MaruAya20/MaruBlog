import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const sess = await getSession();
  if (!sess) {
    redirect("/login");
  }

  // 优先使用数据库中的角色与昵称
  try {
    const u = await prisma.user.findUnique({
      where: { id: sess.uid },
      select: { name: true, role: true },
    });
    if (u && u.role !== "GUEST" && u.name) {
      redirect(`/user/${encodeURIComponent(u.name)}`);
    }
  } catch {
    // 忽略 DB 读取错误，稍后用会话信息兜底
  }

  // 如果数据库读取失败，但会话里已经是已注册用户（AUTHOR / ADMIN），也允许跳到 /user/[name]
  if (sess.role !== "GUEST" && sess.name) {
    redirect(`/user/${encodeURIComponent(sess.name)}`);
  }

  // 其余情况（访客 / 没有昵称）统一回到登录界面
  redirect("/login");
}

