#!/bin/bash

# 平台登录快速测试脚本

echo "═══════════════════════════════════════"
echo "   平台登录快速测试"
echo "═══════════════════════════════════════"
echo ""

# 检查 cookies 目录
COOKIES_DIR="../cookies"
if [ ! -d "$COOKIES_DIR" ]; then
    echo "❌ Cookie 目录不存在: $COOKIES_DIR"
    echo "💡 创建目录: mkdir -p $COOKIES_DIR"
    mkdir -p "$COOKIES_DIR"
    echo "✅ 目录已创建"
fi

echo "📂 Cookie 目录: $COOKIES_DIR"
echo ""

# 检查 Chrome
echo "🔍 检查 Chrome 浏览器..."
if command -v google-chrome &> /dev/null; then
    CHROME_PATH=$(which google-chrome)
    echo "✅ Chrome 已安装: $CHROME_PATH"
elif [ -f "/usr/bin/google-chrome" ]; then
    CHROME_PATH="/usr/bin/google-chrome"
    echo "✅ Chrome 已安装: $CHROME_PATH"
else
    echo "❌ 未找到 Chrome 浏览器"
    echo "💡 请安装 Chrome: sudo apt install google-chrome-stable"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "   选择操作"
echo "═══════════════════════════════════════"
echo ""
echo "1. 登录小红书"
echo "2. 登录抖音"
echo "3. 刷新所有 Cookie"
echo "4. 检查 Cookie 健康状态"
echo "5. 测试小红书抓取"
echo "6. 测试抖音抓取"
echo "7. 退出"
echo ""

read -p "请选择操作 (1-7): " choice

case $choice in
    1)
        echo ""
        echo "🚀 启动小红书登录..."
        npx tsx scripts/login-platform.ts xhs
        ;;
    2)
        echo ""
        echo "🚀 启动抖音登录..."
        npx tsx scripts/login-platform.ts douyin
        ;;
    3)
        echo ""
        echo "🔄 刷新所有平台 Cookie..."
        npx tsx scripts/refresh-cookies.ts all
        ;;
    4)
        echo ""
        echo "🔍 检查 Cookie 健康状态..."
        npx tsx scripts/check-cookie-health.ts
        ;;
    5)
        echo ""
        echo "🧪 测试小红书抓取..."
        echo "测试 ID: 416227302"
        npx tsx -e "
        import { scrapeXhs } from './lib/profileScrape';
        (async () => {
          const result = await scrapeXhs('416227302', 'https://www.xiaohongshu.com/user/profile/416227302');
          console.log('结果:', result.ok ? '✅ 成功' : '❌ 失败');
          console.log('方法:', result.method);
          console.log('摘录长度:', result.excerpt.length);
          if (result.excerpt.length > 0) {
            console.log('摘录预览:', result.excerpt.slice(0, 200));
          }
        })();
        "
        ;;
    6)
        echo ""
        echo "🧪 测试抖音抓取..."
        echo "测试 ID: MS4wLjABAAAAExamplePlaceholder"
        npx tsx -e "
        import { scrapeDouyin } from './lib/profileScrape';
        (async () => {
          const result = await scrapeDouyin('MS4wLjABAAAAExamplePlaceholder', 'https://www.douyin.com/user/MS4wLjABAAAAExamplePlaceholder');
          console.log('结果:', result.ok ? '✅ 成功' : '❌ 失败');
          console.log('方法:', result.method);
          console.log('摘录长度:', result.excerpt.length);
          if (result.excerpt.length > 0) {
            console.log('摘录预览:', result.excerpt.slice(0, 200));
          }
        })();
        "
        ;;
    7)
        echo ""
        echo "👋 再见！"
        exit 0
        ;;
    *)
        echo ""
        echo "❌ 无效的选择"
        exit 1
        ;;
esac

echo ""
echo "═══════════════════════════════════════"
echo "   操作完成"
echo "═══════════════════════════════════════"
echo ""
echo "💡 提示："
echo "   - 查看完整指南: cat PLATFORM_LOGIN_GUIDE.md"
echo "   - 检查 Cookie: npx tsx scripts/check-cookie-health.ts"
echo "   - 刷新 Cookie: npx tsx scripts/refresh-cookies.ts all"
echo ""
