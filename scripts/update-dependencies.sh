#!/bin/bash

# MaruBlog 安全更新脚本
# 用于在服务器上更新依赖以修复安全漏洞

echo "开始 MaruBlog 安全更新..."

# 1. 停止当前运行的应用
echo "停止当前应用..."
if [ -f "pm2.config.js" ]; then
  pm2 stop pm2.config.js 2>/dev/null || echo "PM2 停止命令失败或未安装"
elif [ -f ".next" ]; then
  pkill -f "next start" 2>/dev/null || echo "Next.js 进程不存在或已停止"
fi

# 2. 拉取最新代码
echo "拉取最新代码..."
git pull origin main

# 3. 清理并重新安装依赖
echo "清理旧依赖..."
rm -rf node_modules
rm -f package-lock.json

echo "安装新依赖..."
npm install

# 4. 生成 Prisma 客户端
echo "生成 Prisma 客户端..."
npx prisma generate

# 5. 构建应用
echo "构建应用..."
npm run build

# 6. 启动应用
echo "启动应用..."
if [ -f "pm2.config.js" ]; then
  pm2 start pm2.config.js
  pm2 save
elif command -v pm2 >/dev/null 2>&1; then
  pm2 start "npm run start" --name "marublog"
  pm2 save
else
  # 如果没有 PM2，直接后台运行
  nohup npm start > app.log 2>&1 &
fi

echo "安全更新完成！"
echo "请检查应用是否正常运行："
echo "  - pm2 status (如果使用 PM2)"
echo "  - 或查看 app.log 文件"