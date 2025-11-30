\# MaruBlog



一个基于 Next.js 16（App Router）+ Prisma + PostgreSQL 的个人博客 / 社区项目，支持文章发布、图片与音频上传、标签筛选、等级系统和后台管理。



\## 技术栈



\- Next.js 16（App Router，TypeScript）

\- React 19（客户端组件 + 服务端组件）

\- Prisma ORM + PostgreSQL

\- 原生 CSS（配合少量自定义组件）



\## 开发环境要求



\- Node.js 20+

\- PostgreSQL 14+



\## 本地运行



1\. 安装依赖：



&nbsp;  ```bash

&nbsp;  npm install

&nbsp;  ```



2\. 配置环境变量 `web/.env`（示例）：



&nbsp;  ```env

&nbsp;  DATABASE\_URL="postgresql://user:pass@localhost:5432/marublog?schema=public"

&nbsp;  JWT\_SECRET="dev-secret-change-me"



&nbsp;  # 管理员账号（首个使用此邮箱注册的用户将成为 ADMIN）

&nbsp;  ADMIN\_EMAIL="you@example.com"

&nbsp;  ADMIN\_OP\_CODE=654321



&nbsp;  # 邮件验证码（使用你的 SMTP 服务）

&nbsp;  SMTP\_HOST=smtp.example.com

&nbsp;  SMTP\_PORT=465

&nbsp;  SMTP\_USER=you@example.com

&nbsp;  SMTP\_PASS=your\_smtp\_password

&nbsp;  SMTP\_FROM="MaruBlog <you@example.com>"

&nbsp;  ```



3\. 初始化数据库（只需执行一次迁移）：



&nbsp;  ```bash

&nbsp;  npx prisma migrate deploy

&nbsp;  ```



4\. 启动开发服务器：



&nbsp;  ```bash

&nbsp;  npm run dev

&nbsp;  ```



&nbsp;  打开浏览器访问 `http://localhost:3000`。



\## 主要脚本



\- `npm run dev`：开发模式

\- `npm run build`：生产构建

\- `npm start`：生产运行（基于上一次构建）

\- `npx prisma migrate dev`：本地开发下应用数据表迁移



\## 功能概览



\- 访客模式 + 邮箱验证码登录 / 注册

\- 用户主页 `/user/\[name]`，支持无限滚动加载自己的文章

\- 新建 / 编辑 / 删除文章，支持图片、音频上传和正文内插入

\- 发现页 `/discover`：标签筛选、搜索、收藏

\- 等级系统 `/levels`：根据 XP 显示等级徽章

\- 设置页：用户资料、壁纸、站点设置

\- 后台管理 `/admin`：文章、标签、用户、上传、评论、仪表盘等



\## 部署建议



1\. 在服务器上准备 PostgreSQL，并设置好生产环境的 `DATABASE\_URL` 和 SMTP 配置。

2\. 将代码放到服务器（推荐使用 Git 仓库来管理代码同步）。

3\. 在服务器项目目录：



&nbsp;  ```bash

&nbsp;  npm install

&nbsp;  npx prisma migrate deploy

&nbsp;  npm run build

&nbsp;  npm start

&nbsp;  ```



4\. 使用 Nginx / Caddy 等反向代理，将域名指向该应用。



---



本项目仍在持续开发中，结构和接口可能随时间调整。建议在修改前先阅读 `plan.txt` 了解当前的规划与开发进度。



