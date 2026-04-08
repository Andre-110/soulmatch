import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function testWithRealBrowserFingerprint() {
  console.log('🧪 测试真实浏览器指纹 + Cookie\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
    ],
  });

  // 测试小红书
  console.log('📱 测试小红书...');
  const xhsContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  });

  // 注入反检测脚本
  await xhsContext.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
  });

  const xhsCookies = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '../cookies/cookies (6).json'), 'utf-8')
  ).map((c: any) => ({
    ...c,
    sameSite: c.sameSite === 'unspecified' ? 'Lax' : c.sameSite === 'no_restriction' ? 'None' : c.sameSite,
  }));
  await xhsContext.addCookies(xhsCookies);

  const xhsPage = await xhsContext.newPage();

  try {
    await xhsPage.goto('https://www.xiaohongshu.com/user/profile/5ff0e4a80000000001001234', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await xhsPage.waitForTimeout(5000); // 等待更长时间

    const xhsScreenshot = await xhsPage.screenshot({ fullPage: true });
    fs.writeFileSync('/tmp/xhs-test-real.png', xhsScreenshot);

    const xhsContent = await xhsPage.content();
    const xhsHasLogin = xhsContent.includes('登录') || xhsContent.includes('未连接');
    const xhsHasProfile = xhsContent.includes('关注') || xhsContent.includes('粉丝');

    console.log(`  状态: ${xhsHasProfile ? '✅ 已登录' : '❌ 未登录'}`);
    console.log(`  截图: /tmp/xhs-test-real.png\n`);
  } catch (error: any) {
    console.log(`  ❌ 错误: ${error.message}\n`);
  }

  await xhsContext.close();

  // 测试抖音
  console.log('📱 测试抖音...');
  const douyinContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  });

  await douyinContext.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
  });

  const cookieRoot = path.join(process.cwd(), '..', '..');
  const douyinCookiePath =
    [path.join(cookieRoot, 'cookies (20).json'), path.join(cookieRoot, 'cookies (19).json')].find((p) =>
      fs.existsSync(p),
    );
  if (!douyinCookiePath) throw new Error('未找到 cookies (20).json 或 cookies (19).json');
  const douyinCookies = JSON.parse(fs.readFileSync(douyinCookiePath, 'utf-8')).map((c: any) => ({
    ...c,
    sameSite: c.sameSite === 'unspecified' ? 'Lax' : c.sameSite === 'no_restriction' ? 'None' : c.sameSite,
  }));
  await douyinContext.addCookies(douyinCookies);

  const douyinPage = await douyinContext.newPage();

  try {
    await douyinPage.goto('https://www.douyin.com/user/MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await douyinPage.waitForTimeout(5000);

    const douyinScreenshot = await douyinPage.screenshot({ fullPage: false });
    fs.writeFileSync('/tmp/douyin-test-real.png', douyinScreenshot);

    const douyinContent = await douyinPage.content();
    const douyinHasVerify = douyinContent.includes('验证') || douyinContent.includes('滑动');
    const douyinHasProfile = douyinContent.includes('关注') || douyinContent.includes('粉丝');

    console.log(`  状态: ${douyinHasProfile ? '✅ 已登录' : douyinHasVerify ? '⚠️  需要验证' : '❌ 未登录'}`);
    console.log(`  截图: /tmp/douyin-test-real.png\n`);
  } catch (error: any) {
    console.log(`  ❌ 错误: ${error.message}\n`);
  }

  await douyinContext.close();
  await browser.close();

  console.log('✅ 测试完成！');
}

testWithRealBrowserFingerprint().catch(console.error);
