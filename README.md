# MaruBlog

一个基于 Next.js 16（App Router）+ Prisma + PostgreSQL 的个人博客 / 社区项目，支持用户系统、文章发布、评论、标签筛选、等级系统和后台管理。


## 技术栈

- Next.js 16（App Router，TypeScript）
- React 19（客户端组件 + 服务器组件）
- Prisma ORM + PostgreSQL
- 原生 CSS / Tailwind 样式（支持暗色模式与响应式布局）


## 环境要求

- Node.js 20+
- PostgreSQL 14+


## 本地开发

1. 安装依赖

   ```bash
   npm install
   ```

2. 配置环境变量，在项目根目录创建 `.env`（或根据需要使用 `.env.local` 等）

   ```env
   DATABASE_URL="postgresql://user:pass@localhost:5432/marublog?schema=public"
   JWT_SECRET="dev-secret-change-me"

   # 管理员账号（首次使用可通过代码设为 ADMIN）
   ADMIN_EMAIL="you@example.com"
   ADMIN_OP_CODE=654321

   # 邮件发送（使用你的 SMTP 服务）
   SMTP_HOST=smtp.example.com
   SMTP_PORT=465
   SMTP_USER=you@example.com
   SMTP_PASS=your_smtp_password
   SMTP_FROM="MaruBlog <you@example.com>"
   ```

3. 初始化数据库（只需在首次部署或结构变更后执行一次迁移）

   ```bash
   npx prisma migrate deploy
   ```

4. 启动本地开发服务

   ```bash
   npm run dev
   ```

   访问 `http://localhost:3000` 即可。


## 常用脚本

- `npm run dev`：本地开发模式
- `npm run build`：构建生产版本
- `npm start`：启动生产服务（需先执行过构建）
- `npx prisma migrate dev`：本地开发时创建 / 应用数据库迁移


## 功能概览

- 邮箱验证码登录 / 注册（含“游客登录”模式）
- 用户主页 `/user/[name]`：支持查看用户信息和文章列表
- 新建 / 编辑 / 删除文章，支持封面图和富文本内容
- 发现页 `/discover`：支持按标签筛选、按热度 / 时间排序
- 等级系统 `/levels`：展示 XP 与等级规则
- 设置页：用户资料、站点外观（如背景图）等配置
- 管理后台 `/admin`：文章、标签、用户、上传资源、评论等管理


## 生产部署

1. 在服务器准备好 PostgreSQL，并配置好 `DATABASE_URL` 和 SMTP 相关环境变量。
2. 将代码拉取到服务器（建议使用 Git 仓库同步）。
3. 在项目目录执行：

   ```bash
   npm install
   npx prisma migrate deploy
   npm run build
   npm start
   ```

4. 使用 Nginx / Caddy 等反向代理将域名流量转发到本应用（默认监听 `3000` 端口）。


---

本项目仍在持续迭代中，结构和接口可能发生变化。如需进行较大改动，建议先阅读 `plan.txt`，了解当前的规划与开发优先级。

