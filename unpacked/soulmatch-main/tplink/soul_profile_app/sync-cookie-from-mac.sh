#!/bin/bash

# 小红书 Cookie 同步脚本
# 在 Mac 上运行，自动同步 Cookie 到服务器

echo "=========================================="
echo "小红书 Cookie 同步工具"
echo "=========================================="
echo ""

# 配置
MAC_COOKIE_PATH="/Users/liuqi/Downloads/cookies (14).json"
SERVER_USER="ecs-user"
SERVER_HOST="your-server-ip"  # 替换为你的服务器 IP
SERVER_PATH="/home/ecs-user/cookies/cookies (6).json"

echo "📁 本地 Cookie: $MAC_COOKIE_PATH"
echo "🖥️  服务器: $SERVER_USER@$SERVER_HOST"
echo "📂 目标路径: $SERVER_PATH"
echo ""

# 检查本地文件
if [ ! -f "$MAC_COOKIE_PATH" ]; then
    echo "❌ 本地 Cookie 文件不存在"
    echo "请先在浏览器中登录小红书并导出 Cookie"
    exit 1
fi

echo "✅ 本地 Cookie 文件存在"
echo ""

# 验证 Cookie 有效性（可选）
echo "🔍 验证 Cookie..."
COOKIE_COUNT=$(cat "$MAC_COOKIE_PATH" | jq 'length' 2>/dev/null)
if [ -z "$COOKIE_COUNT" ]; then
    echo "⚠️  无法解析 Cookie 文件（可能不是有效的 JSON）"
else
    echo "✅ Cookie 数量: $COOKIE_COUNT"
fi
echo ""

# 上传到服务器
echo "📤 上传 Cookie 到服务器..."
scp "$MAC_COOKIE_PATH" "$SERVER_USER@$SERVER_HOST:$SERVER_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Cookie 已成功同步到服务器"
    echo ""
    echo "🧪 在服务器上验证 Cookie:"
    echo "  ssh $SERVER_USER@$SERVER_HOST 'cd /home/ecs-user/tplink-app/tplink/soul_profile_app && ./verify-xhs-cookie.sh'"
else
    echo "❌ 上传失败"
    exit 1
fi

echo ""
echo "=========================================="
echo "💡 提示:"
echo "  - 建议每周运行一次此脚本"
echo "  - 可以设置 cron 定时任务自动同步"
echo "  - 如果 Cookie 失效，重新登录后再次运行"
echo "=========================================="
