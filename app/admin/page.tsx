import Container from "../components/Container";
import { getSession } from "@/lib/auth";
import { getAdminElevation } from "@/lib/adminGuard";
import { notFound } from "next/navigation";

export default async function AdminHome() {
  const sess = await getSession();
  if (!sess || sess.role !== "ADMIN") {
    // 对非管理员伪装为 404，避免暴露后台入口
    notFound();
  }

  const st = await getAdminElevation(sess.uid);

  const userLabel =
    sess.name || sess.email || `管理员${String(sess.uid)}`;

  return (
    <Container>
      <section className="section">
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>后台管理</div>
          <div style={{ fontSize: 14 }}>
            当前账号：
            <span style={{ fontWeight: 500 }}>{userLabel}</span>
          </div>
          <div style={{ fontSize: 14 }}>
            安全状态：
            <span
              style={{
                fontWeight: 500,
                color: st.elevated ? "#4caf50" : "#f97316",
              }}
            >
              {st.elevated ? "已通过管理操作验证" : "未验证"}
            </span>
            {st.until && (
              <span className="hint" style={{ marginLeft: 6 }}>
                （有效期至 {String(st.until)}）
              </span>
            )}
          </div>
          <div className="hint">
            提示：在具体的管理页面（例如“上传资源审核”）中输入管理操作码，可在一段时间内执行敏感操作。
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <a
              href="/admin/dashboard"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              站点仪表盘
            </a>
            <a
              href="/admin/uploads"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              上传资源审核
            </a>
            <a
              href="/admin/posts"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              文章管理
            </a>
            <a
              href="/admin/tags"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              标签管理
            </a>
            <a
              href="/admin/comments"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              评论审核 / 封禁
            </a>
            <a
              href="/admin/users"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              用户列表 / 封禁
            </a>
            <a
              href="/admin/settings"
              className="nav-link"
              style={{ width: "fit-content", cursor: "pointer" }}
            >
              站点设置
            </a>
            <div className="hint">
              未来这里会陆续加入：更多用户管理、站点设置扩展等入口。
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}
