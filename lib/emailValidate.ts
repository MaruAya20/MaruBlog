import dns from "node:dns/promises";

// 简单的邮箱格式校验：避免明显错误（多个 @、缺少域名等）
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  const str = (email || "").trim();
  if (!str) return false;
  return SIMPLE_EMAIL_RE.test(str);
}

// 通过 DNS 查询邮箱域名是否存在 MX / A 记录，粗略判断邮箱是否“可用”
export async function isEmailDomainReachable(
  email: string,
): Promise<boolean> {
  const str = (email || "").trim();
  const at = str.lastIndexOf("@");
  if (at <= 0 || at === str.length - 1) return false;

  const domain = str.slice(at + 1).toLowerCase();
  if (!domain || !domain.includes(".")) return false;

  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length > 0) return true;
  } catch {
    // ignore and try A 记录
  }

  try {
    const addrs = await dns.resolve(domain);
    return Array.isArray(addrs) && addrs.length > 0;
  } catch {
    return false;
  }
}

