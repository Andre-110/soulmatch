#!/bin/bash

echo "=========================================="
echo "小红书 Cookie 验证工具"
echo "=========================================="
echo ""

COOKIE_FILE="/home/ecs-user/tplink-app/cookies (13).json"

if [ ! -f "$COOKIE_FILE" ]; then
    echo "❌ Cookie 文件不存在: $COOKIE_FILE"
    exit 1
fi

echo "📁 Cookie 文件: $COOKIE_FILE"
echo "📊 Cookie 数量: $(cat "$COOKIE_FILE" | jq 'length')"
echo ""

# 检查关键 Cookie
echo "🔍 检查关键 Cookie:"
HAS_WEB_SESSION=$(cat "$COOKIE_FILE" | jq -r '.[] | select(.name == "web_session") | .value' | wc -c)
HAS_A1=$(cat "$COOKIE_FILE" | jq -r '.[] | select(.name == "a1") | .value' | wc -c)

if [ "$HAS_WEB_SESSION" -gt 10 ]; then
    echo "  ✅ web_session 存在"
else
    echo "  ❌ web_session 缺失"
fi

if [ "$HAS_A1" -gt 10 ]; then
    echo "  ✅ a1 存在"
else
    echo "  ❌ a1 缺失"
fi

echo ""
echo "🌐 测试 Cookie 有效性..."

# 构建 Cookie Header
COOKIE_HEADER=$(cat "$COOKIE_FILE" | jq -r '.[] | "\(.name)=\(.value)"' | paste -sd ';')

# 测试访问
RESPONSE=$(curl -s -H "Cookie: $COOKIE_HEADER" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  https://www.xiaohongshu.com)

if echo "$RESPONSE" | grep -q "登录"; then
    echo "  ❌ Cookie 无效（页面要求登录）"
    echo ""
    echo "📝 解决方案:"
    echo "  1. 在浏览器中访问 https://www.xiaohongshu.com"
    echo "  2. 完整登录账号"
    echo "  3. 浏览几个页面确保会话激活"
    echo "  4. 使用 EditThisCookie 插件导出"
    echo "  5. 保存到: $COOKIE_FILE"
    echo "  6. 重新运行此脚本验证"
else
    echo "  ✅ Cookie 可能有效（未检测到登录提示）"
    echo ""
    echo "🎉 可以继续测试完整功能:"
    echo "  npx tsx test-xhs-scrape.ts"
fi

echo ""
echo "=========================================="
