"use client";
import { useEffect, useState } from "react";
import Container from "../components/Container";

function validateNickname(name: string): boolean {
  const str = (name || "").trim();
  if (!str) return false;
  const chinese = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (str.match(/[A-Za-z0-9]/g) || []).length;
  const total = english + chinese * 2; // 1 个中文按 2 个英文计
  return total >= 3 && total <= 30;
}

export default function Login() {
  // 登录卡片
  const [loginEmail, setLoginEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginCooldown, setLoginCooldown] = useState(0);

  // 注册卡片
  const [regEmail, setRegEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regCooldown, setRegCooldown] = useState(0);

  // 访客卡片
  const [guestName, setGuestName] = useState("");

  const [msg, setMsg] = useState("");

  // 登录验证码倒计时
  useEffect(() => {
    if (!loginCooldown) return;
    const id = window.setInterval(() => {
      setLoginCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [loginCooldown]);

  // 注册验证码倒计时
  useEffect(() => {
    if (!regCooldown) return;
    const id = window.setInterval(() => {
      setRegCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [regCooldown]);

  async function requestLoginCode() {
    if (!loginEmail.trim()) {
      setMsg("请输入用于登录的邮箱");
      return;
    }
    if (loginCooldown > 0) return;
    setMsg("正在发送登录验证码...");
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, mode: "login" }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setLoginCooldown(60);
      setMsg("登录验证码已发送，请在 60 秒内查收");
    } else if (d?.error === "no_user") {
      setMsg("该邮箱尚未注册，请先在右侧进行注册");
    } else if (d?.error === "too_frequent") {
      const sec = d?.retryAfter ?? 60;
      setLoginCooldown(sec);
      setMsg(d?.message || `获取验证码太频繁，请在 ${sec} 秒后再试`);
    } else if (d?.error === "user_banned") {
      const isPermanent = !!d.permanent;
      let tip = "";
      if (isPermanent) {
        tip = "用户权限已被永久封禁";
      } else if (d.until) {
        const t = new Date(String(d.until));
        if (!Number.isNaN(t.getTime())) {
          const local = t.toLocaleString();
          tip = `用户权限直到 ${local} 解禁！`;
        }
      }
      if (d.reason) {
        const reasonText = String(d.reason);
        tip = tip
          ? `${tip} 封禁原因：${reasonText}`
          : `用户权限已被封禁，原因：${reasonText}`;
      }
      setMsg(tip || "用户权限当前被封禁，请稍后再试");
    } else {
      setMsg(d?.message || d?.error || "发送登录验证码失败，请稍后再试");
    }
  }

  async function login() {
    if (!loginEmail.trim() || !loginCode.trim()) {
      setMsg("请输入邮箱和验证码");
      return;
    }
    setMsg("正在登录...");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, code: loginCode }),
    });
    if (res.ok) {
      location.href = "/";
      return;
    }
    const d = await res.json().catch(() => ({}));
    if (d?.error === "user_banned") {
      const isPermanent = !!d.permanent;
      let tip = "";
      if (isPermanent) {
        tip = "用户权限已被永久封禁";
      } else if (d.until) {
        const t = new Date(String(d.until));
        if (!Number.isNaN(t.getTime())) {
          const local = t.toLocaleString();
          tip = `用户权限直到 ${local} 解禁！`;
        }
      }
      if (d.reason) {
        const reasonText = String(d.reason);
        tip = tip
          ? `${tip} 封禁原因：${reasonText}`
          : `用户权限已被封禁，原因：${reasonText}`;
      }
      setMsg(tip || "用户权限当前被封禁，请稍后再试");
    } else if (d?.error === "no_user") {
      setMsg("该邮箱尚未注册，请先注册");
    } else if (d?.error === "code invalid") {
      setMsg("验证码无效或已过期");
    } else {
      setMsg(d?.message || d?.error || "登录失败，请稍后再试");
    }
  }

  async function requestRegisterCode() {
    if (!regEmail.trim()) {
      setMsg("请输入用于注册的邮箱");
      return;
    }
    if (regCooldown > 0) return;
    setMsg("正在发送注册验证码...");
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: regEmail, mode: "register" }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setRegCooldown(60);
      setMsg("注册验证码已发送，请在 60 秒内查收");
    } else if (d?.error === "user_exists") {
      setMsg("该邮箱已注册，请使用左侧登录");
    } else if (d?.error === "too_frequent") {
      const sec = d?.retryAfter ?? 60;
      setRegCooldown(sec);
      setMsg(d?.message || `获取验证码太频繁，请在 ${sec} 秒后再试`);
    } else {
      setMsg(d?.message || d?.error || "发送注册验证码失败，请稍后再试");
    }
  }

  async function register() {
    if (!regEmail.trim() || !regCode.trim() || !regName.trim()) {
      setMsg("请输入邮箱、验证码和昵称");
      return;
    }
    if (!validateNickname(regName)) {
      setMsg("昵称长度需 3~30 个英文字符（1 个中文按 2 个英文计）");
      return;
    }
    setMsg("正在注册...");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: regEmail,
        code: regCode,
        name: regName,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      location.href = "/";
      return;
    }
    if (d?.error === "invalid_nickname") {
      setMsg(
        d?.message ||
          "昵称需≥3英文或≥2中文，且≤20英文或≤15中文",
      );
    } else if (d?.error === "user_exists") {
      setMsg("该邮箱已注册，请使用左侧登录");
    } else if (d?.error === "code invalid") {
      setMsg("验证码无效或已过期");
    } else {
      setMsg(d?.message || d?.error || "注册失败，请稍后再试");
    }
  }

  async function guest() {
    setMsg("正在以访客身份登录...");
    const res = await fetch("/api/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: guestName }),
    });
    if (res.ok) {
      location.href = "/";
    } else {
      setMsg("访客登录失败，请稍后再试");
    }
  }

  return (
    <Container>
      <section
        className="section"
        style={{ display: "grid", gap: 16 }}
      >
        {/* 登录卡片 */}
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600 }}>邮箱登录（已有账号）</div>
          <input
            placeholder="邮箱"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="nav-link"
              onClick={requestLoginCode}
              disabled={loginCooldown > 0}
              style={{
                cursor: loginCooldown ? "not-allowed" : "pointer",
              }}
            >
              {loginCooldown
                ? `重发(${loginCooldown}s)`
                : "获取验证码"}
            </button>
            <input
              placeholder="验证码"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "transparent",
                color: "var(--text)",
              }}
            />
            <button
              className="nav-link"
              onClick={login}
              style={{ cursor: "pointer" }}
            >
              登录
            </button>
          </div>
        </div>

        {/* 注册卡片 */}
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600 }}>注册新用户</div>
          <input
            placeholder="邮箱"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <input
            placeholder="昵称（需≥3英文或≥2中文，且≤20英文或≤15中文）"
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="nav-link"
              onClick={requestRegisterCode}
              disabled={regCooldown > 0}
              style={{
                cursor: regCooldown ? "not-allowed" : "pointer",
              }}
            >
              {regCooldown
                ? `重发(${regCooldown}s)`
                : "获取验证码"}
            </button>
            <input
              placeholder="验证码"
              value={regCode}
              onChange={(e) => setRegCode(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "transparent",
                color: "var(--text)",
              }}
            />
            <button
              className="nav-link"
              onClick={register}
              style={{ cursor: "pointer" }}
            >
              注册并登录
            </button>
          </div>
        </div>

        {/* 访客登录卡片 */}
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600 }}>访客登录（仅限站内体验）</div>
          <input
            placeholder="昵称（可选）"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            style={{
              padding: "8px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
            }}
          />
          <button
            className="nav-link"
            onClick={guest}
            style={{ cursor: "pointer" }}
          >
            以访客身份进入
          </button>
        </div>

        {msg && <div className="hint">{msg}</div>}
      </section>
    </Container>
  );
}
