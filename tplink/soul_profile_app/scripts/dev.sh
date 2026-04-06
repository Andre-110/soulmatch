#!/usr/bin/env bash
# 启动 Next 开发服务前先释放本机监听端口，避免「端口占用 / 已有 dev server」。
# 用法：npm run dev  或  PORT=3001 npm run dev
# 若 3000 上是其它程序，请改 PORT，或使用 npm run dev:plain（不查杀）

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -z "$PIDS" ]]; then
    PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
  fi
  if [[ -n "$PIDS" ]]; then
    echo "[dev] 释放端口 ${PORT} …"
    # lsof -t 输出空格分隔的 PID
    # shellcheck disable=SC2086
    kill $PIDS 2>/dev/null || true
    sleep 0.35
  fi
else
  echo "[dev] 未找到 lsof，跳过端口清理（可安装后重试）" >&2
fi

# 监听 0.0.0.0：本机 / 局域网 / SSH 端口转发均可访问（否则部分环境只绑 127.0.0.1）
exec next dev -H 0.0.0.0 "$@"
