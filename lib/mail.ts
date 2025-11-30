import nodemailer from "nodemailer";

type LoginCodeKind = "login" | "register";

// 懒加载 SMTP transporter，避免在没有配置时报错
let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "";

  return {
    host,
    port: portStr ? Number(portStr) : 465,
    user,
    pass,
    from,
  };
}

async function getTransporter() {
  if (!transporterPromise) {
    const { host, port, user, pass } = getSmtpConfig();
    if (!host || !user || !pass) {
      throw new Error("SMTP 未配置完整，无法发送邮件");
    }
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 常用 SSL，其它端口通常为 STARTTLS
        auth: {
          user,
          pass,
        },
      }),
    );
  }
  return transporterPromise;
}

export async function sendLoginCodeEmail(
  email: string,
  code: string,
  kind: LoginCodeKind,
) {
  const { from } = getSmtpConfig();

  const subject =
    kind === "register" ? "MaruBlog 注册验证码" : "MaruBlog 登录验证码";
  const text = [
    `您好！`,
    "",
    `您的 ${kind === "register" ? "注册" : "登录"} 验证码为：${code}`,
    "请在 10 分钟内使用该验证码完成操作。",
    "",
    "如果这不是您本人的操作，请忽略本邮件。",
  ].join("\n");
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; font-size: 14px; color: #111827;">
      <p>您好！</p>
      <p>您的 ${
        kind === "register" ? "注册" : "登录"
      }验证码为：</p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 4px; padding: 8px 12px; border-radius: 6px; display: inline-block; background: #111827; color: #f9fafb;">
        ${code}
      </p>
      <p>请在 <strong>10 分钟</strong> 内使用该验证码完成操作。</p>
      <p style="color:#6b7280;">如果这不是您本人的操作，请忽略本邮件。</p>
      <p style="margin-top:16px;color:#9ca3af;">—— MaruBlog</p>
    </div>
  `;

  const transporter = await getTransporter();
  await transporter.sendMail({
    from: from || undefined,
    to: email,
    subject,
    text,
    html,
  });
}

