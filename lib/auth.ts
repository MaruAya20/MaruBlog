import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret",
);
const COOKIE = "sess";

export type Session = {
  uid: number;
  role: "ADMIN" | "AUTHOR" | "GUEST";
  name?: string;
  email?: string;
};

export async function setSession(sess: Session) {
  const jwt = await new SignJWT(sess)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const sess = payload as Session;

    // 如用户被封禁登录，则清除会话并视为未登录（管理员账号不受影响）
    if (sess.role !== "ADMIN") {
      try {
        // 延迟加载 prisma，避免在潜在的 client 环境中打包进来
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
        const now = new Date();
        const ban = await prisma.userBan.findFirst({
          where: {
            userId: sess.uid,
            OR: [
              { permanent: true },
              { until: { gt: now } },
            ],
          },
          orderBy: { until: "desc" },
        });
        if (ban) {
          await clearSession();
          return null;
        }
      } catch {
        // 忽略封禁检查错误，避免影响正常登录
      }
    }

    return sess;
  } catch {
    return null;
  }
}
