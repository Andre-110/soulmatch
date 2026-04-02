#!/usr/bin/env bash
# 生产环境启动脚本：兼容 Next.js 16 fork 行为，供 PM2 管理
# Next.js 16 的 `next start` 会 fork 出 next-server 子进程后自身退出，
# 本脚本负责追踪 next-server 的 PID，并在收到 SIGTERM/SIGINT 时正确清理。

set -eu

PORT="${PORT:-3010}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# 清理端口上残留的旧进程
cleanup_port() {
  local pids
  pids=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[start-prod] 清理端口 ${PORT} 上的旧进程: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

cleanup_port

echo "[start-prod] 启动 Next.js 生产服务器 (端口 ${PORT})..."

# 在后台启动 next start，它会 fork next-server 然后自身退出
node_modules/.bin/next start --port "$PORT" &
LAUNCHER_PID=$!

# 等待 next-server 出现在端口上（最多 30 秒）
SERVER_PID=""
for i in $(seq 1 30); do
  sleep 1
  SERVER_PID=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$SERVER_PID" ]; then
    echo "[start-prod] next-server 已启动，PID=$SERVER_PID"
    break
  fi
done

# 等待 launcher 退出（正常行为）
wait "$LAUNCHER_PID" 2>/dev/null || true

if [ -z "$SERVER_PID" ]; then
  echo "[start-prod] 错误：next-server 未能在 30 秒内启动" >&2
  exit 1
fi

# 注册信号处理：收到 TERM/INT 时关闭 next-server
shutdown() {
  echo "[start-prod] 收到停止信号，关闭 next-server (PID=$SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  echo "[start-prod] 已停止"
  exit 0
}
trap shutdown TERM INT

echo "[start-prod] 服务运行中，等待 next-server (PID=$SERVER_PID) 退出..."

# 持续检测 next-server 是否还活着
while kill -0 "$SERVER_PID" 2>/dev/null; do
  sleep 2
done

echo "[start-prod] next-server 已退出"
exit 0
