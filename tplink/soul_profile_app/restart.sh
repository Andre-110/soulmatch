#!/bin/bash

echo "🔄 重启 Next.js 服务器..."

# 1. 杀掉所有 next 相关进程
echo "📛 停止现有进程..."
pkill -9 -f "next-server"
pkill -9 -f "next start"
pkill -9 -f "next build"
sleep 2

# 2. 与 package.json 生产端口一致（见 scripts/start.sh，默认 3010）
PROD_PORT="${PROD_PORT:-3010}"
if lsof -i :"${PROD_PORT}" >/dev/null 2>&1; then
  echo "⚠️  端口 ${PROD_PORT} 仍被占用，强制释放..."
  fuser -k "${PROD_PORT}"/tcp 2>/dev/null
  sleep 1
fi

# 3. 检查构建是否存在
if [ ! -f ".next/BUILD_ID" ]; then
  echo "⚠️  构建文件不存在，开始构建..."
  npx next build
fi

# 4. 启动服务器
echo "🚀 启动服务器..."
npx next start -H 0.0.0.0 -p "${PROD_PORT}" > /tmp/next-server.log 2>&1 &

# 5. 等待启动
echo "⏳ 等待服务器启动..."
for i in {1..30}; do
  sleep 1
  if curl -s "http://localhost:${PROD_PORT}/api/health" >/dev/null 2>&1; then
    echo "✅ 服务器启动成功！"
    curl -s "http://localhost:${PROD_PORT}/api/health" | jq '.'
    exit 0
  fi
  echo -n "."
done

echo ""
echo "❌ 服务器启动超时，查看日志："
tail -20 /tmp/next-server.log
exit 1
