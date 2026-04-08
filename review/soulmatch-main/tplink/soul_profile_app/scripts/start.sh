#!/usr/bin/env bash
# 生产启动：先释放 PORT（默认 3010），避免 EADDRINUSE 导致仍跑旧构建、新代码不生效。
#
# 若启动后立刻出现一行「Killed」且无 Node 堆栈：多为 Linux OOM（内存不足）杀进程。
# 验证：sudo dmesg -T | tail -30 | grep -i 'killed process\|out of memory'
# 缓解：加 swap / 增大内存；或先单独 npm run build，隔几秒再 npm run start；
#       小机器可在 .env 设 RESOURCE_MONITOR_ENABLED=0。
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 限制 V8 堆。注意：不能用 ${VAR:--max...}（bash 会把默认值解析成 -max…，少一个「-」，Node 会报错）
# 默认略收紧堆上限以省内存；重任务 OOM 时可 export NODE_OPTIONS=--max-old-space-size=1536
if [ -z "${NODE_OPTIONS:-}" ]; then
  export NODE_OPTIONS="--max-old-space-size=1280"
fi

PORT="${PORT:-3010}"
# build 刚结束时内存紧张，多等几秒再 listen，减轻 OOM（可用环境变量覆盖秒数）
START_DELAY_AFTER_RELEASE="${START_DELAY_AFTER_RELEASE:-3}"

# 尽量释放端口：单次 fuser 可能杀不干净或子进程晚退 → 多轮 SIGKILL + lsof 确认。
release_port() {
  local i=0
  while [ "$i" -lt 15 ]; do
    if command -v fuser >/dev/null 2>&1; then
      fuser -k -9 "${PORT}/tcp" 2>/dev/null || true
    fi
    if command -v lsof >/dev/null 2>&1; then
      # shellcheck disable=SC2046
      PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || lsof -ti ":$PORT" 2>/dev/null || true)
      if [[ -n "${PIDS:-}" ]]; then
        kill -9 $PIDS 2>/dev/null || true
      fi
    fi
    # 无 lsof 时无法精确判断，直接结束循环交给下一轮或 exec
    if ! command -v lsof >/dev/null 2>&1; then
      break
    fi
    if [[ -z "$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)" ]]; then
      return 0
    fi
    sleep 0.5
    i=$((i + 1))
  done
  echo "[start.sh] 警告: 端口 ${PORT} 仍可能有进程占用（若 EADDRINUSE，请 sudo lsof -i :${PORT} 或 sudo fuser -k -9 ${PORT}/tcp）" >&2
}

release_port
sleep "$START_DELAY_AFTER_RELEASE"

exec next start -H 0.0.0.0 -p "$PORT" "$@"
