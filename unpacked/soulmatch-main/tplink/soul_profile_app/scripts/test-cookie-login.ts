import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function testCookieLogin() {
  console.log('🧪 测试 Cookie 登录状态\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  // 测试小红书
  console.log('📱 测试小红书...');
  const xhsContext = await browser.newContext();
  const xhsCookies = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '../cookies/cookies (6).json'), 'utf-8')
  ).map((c: any) => ({
    ...c,
    sameSite: c.sameSite === 'unspecified' ? 'Lax' : c.sameSite === 'no_restriction' ? 'None' : c.sameSite,
  }));
  await xhsContext.addCookies(xhsCookies);

  const xhsPage = await xhsContext.newPage();
  await xhsPage.goto('https://www.xiaohongshu.com/user/profile/5ff0e4a80000000001001234', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await xhsPage.waitForTimeout(3000);
  const xhsScreenshot = await xhsPage.screenshot({ fullPage: true });
  fs.writeFileSync('/tmp/xhs-test.png', xhsScreenshot);

  const xhsContent = await xhsPage.content();
  const xhsHasLogin = xhsContent.includes('登录') || xhsContent.includes('未连接');

  console.log(`  状态: ${xhsHasLogin ? '❌ 未登录' : '✅ 已登录'}`);
  console.log(`  截图: /tmp/xhs-test.png\n`);

  await xhsContext.close();

  // 测试抖音
  console.log('📱 测试抖音...');
  const douyinContext = await browser.newContext();
  const douyinCookies = JSON.parse(
    fs.readFileSync(
      [path.join(process.cwd(), '..', '..', 'cookies (20).json'), path.join(process.cwd(), '..', '..', 'cookies (19).json')].find((p) =>
        fs.existsSync(p),
      ) || path.join(process.cwd(), '..', '..', 'cookies (20).json'),
      'utf-8',
    )
  ).map((c: any) => ({
    ...c,
    sameSite: c.sameSite === 'unspecified' ? 'Lax' : c.sameSite === 'no_restriction' ? 'None' : c.sameSite,
  }));
  await douyinContext.addCookies(douyinCookies);

  const douyinPage = await douyinContext.newPage();
  await douyinPage.goto('https://www.douyin.com/user/MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await douyinPage.waitForTimeout(3000);
  const douyinScreenshot = await douyinPage.screenshot({ fullPage: true });
  fs.writeFileSync('/tmp/douyin-test.png', douyinScreenshot);

  const douyinContent = await douyinPage.content();
  const douyinHasVerify = douyinContent.includes('验证') || douyinContent.includes('滑动');

  console.log(`  状态: ${douyinHasVerify ? '❌ 需要验证' : '✅ 正常访问'}`);
  console.log(`  截图: /tmp/douyin-test.png\n`);

  await douyinContext.close();
  await browser.close();

  console.log('✅ 测试完成！');
}

testCookieLogin().catch(console.error);
