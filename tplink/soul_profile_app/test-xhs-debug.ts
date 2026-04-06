import { scrapeXhs } from './lib/profileScrape';
import { screenshotMultiplePlatforms } from './lib/screenshotPlatformBatch';
import { getCookieHeader } from './lib/loadCookies';
import fs from 'fs';
import path from 'path';

async function testXhsWithDebug() {
  console.log('='.repeat(80));
  console.log('小红书 Cookie 调试测试');
  console.log('='.repeat(80));

  // 检查 Cookie
  console.log('\n1. 检查 Cookie 文件...');
  const cookieHeader = getCookieHeader('xhs');
  console.log('Cookie Header 长度:', cookieHeader.length);
  console.log('Cookie Header 前 200 字符:', cookieHeader.slice(0, 200));

  // 检查关键 Cookie
  const hasWebSession = cookieHeader.includes('web_session');
  const hasA1 = cookieHeader.includes('a1=');
  console.log('包含 web_session:', hasWebSession ? '✅' : '❌');
  console.log('包含 a1:', hasA1 ? '✅' : '❌');

  // 测试直接访问首页
  console.log('\n2. 测试访问小红书首页...');
  const testUrl = 'https://www.xiaohongshu.com';

  try {
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Cookie': cookieHeader,
      },
    });

    console.log('HTTP 状态:', response.status);
    const html = await response.text();
    console.log('响应长度:', html.length);
    console.log('包含"登录":', html.includes('登录') ? '❌ 是（未登录）' : '✅ 否（已登录）');
    console.log('包含"该内容无法展示":', html.includes('该内容无法展示') ? '❌ 是' : '✅ 否');
  } catch (error) {
    console.error('请求失败:', error);
  }

  // 测试 API
  console.log('\n3. 测试搜索 API...');
  const testUserId = '5c7614b60000000007024f75';
  const testProfileUrl = `https://www.xiaohongshu.com/user/profile/${testUserId}`;

  const scrapeResult = await scrapeXhs(testUserId, testProfileUrl);
  console.log('抓取状态:', scrapeResult.ok ? '✅' : '❌');
  console.log('抓取方法:', scrapeResult.method);
  console.log('摘录长度:', scrapeResult.excerpt.length);

  console.log('\n' + '='.repeat(80));
}

testXhsWithDebug()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试出错:', error);
    process.exit(1);
  });
