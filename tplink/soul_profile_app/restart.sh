#!/bin/bash

echo "🔄 重启 Next.js 服务器..."

# 1. 杀掉所有 next 相关进程
echo "📛 停止现有进程..."
pkill -9 -f "next-server"
pkill -9 -f "next start"
pkill -9 -f "next build"
sleep 2

# 2. 检查端口是否释放
if lsof -i :3000 >/dev/null 2>&1; then
  echo "⚠️  端口 3000 仍被占用，强制释放..."
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
fi

# 3. 检查构建是否存在
if [ ! -f ".next/BUILD_ID" ]; then
  echo "⚠️  构建文件不存在，开始构建..."
  npx next build
fi

# 4. 启动服务器
echo "🚀 启动服务器..."
npx next start -H 0.0.0.0 -p 3000 > /tmp/next-server.log 2>&1 &

# 5. 等待启动
echo "⏳ 等待服务器启动..."
for i in {1..30}; do
  sleep 1
  if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ 服务器启动成功！"
    curl -s http://localhost:3000/api/health | jq '.'
    exit 0
  fi
  echo -n "."
done

echo ""
echo "❌ 服务器启动超时，查看日志："
tail -20 /tmp/next-server.log
exit 1
