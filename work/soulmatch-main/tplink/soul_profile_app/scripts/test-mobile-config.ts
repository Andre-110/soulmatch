import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

type RawCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
};

function toPwCookies(raw: RawCookie[]) {
  return raw
    .filter((c) => c.name && c.value && c.domain)
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || '/',
      secure: c.secure ?? false,
      httpOnly: c.httpOnly ?? false,
      sameSite: (['Strict', 'Lax', 'None'].includes(c.sameSite ?? '')
        ? c.sameSite
        : 'None') as 'Strict' | 'Lax' | 'None',
      expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
    }));
}

async function testMobileConfig() {
  console.log('🧪 测试移动端配置（与历史成功配置一致）\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 测试小红书
  console.log('📱 测试小红书（移动端）...');
  const xhsContext = await browser.newContext({
    viewport: { width: 390, height: 844 },  // iPhone 尺寸
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
  });

  const xhsCookies = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '../cookies/cookies (6).json'), 'utf-8')
  );
  await xhsContext.addCookies(toPwCookies(xhsCookies));

  const xhsPage = await xhsContext.newPage();

  try {
    await xhsPage.goto('https://www.xiaohongshu.com/user/profile/5ff0e4a80000000001001234', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await xhsPage.waitForTimeout(2000);

    const xhsScreenshot = await xhsPage.screenshot({ fullPage: false, type: 'png' });
    fs.writeFileSync('/tmp/xhs-mobile.png', xhsScreenshot);

    const xhsContent = await xhsPage.content();
    const xhsHasProfile = xhsContent.includes('关注') || xhsContent.includes('粉丝') || xhsContent.includes('获赞');

    console.log(`  状态: ${xhsHasProfile ? '✅ 已登录' : '❌ 未登录'}`);
    console.log(`  截图: /tmp/xhs-mobile.png\n`);
  } catch (error: any) {
    console.log(`  ❌ 错误: ${error.message}\n`);
  }

  await xhsContext.close();

  // 测试抖音
  console.log('📱 测试抖音（移动端）...');
  const douyinContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
  });

  const douyinCookies = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '..', '..', 'cookies (19).json'), 'utf-8')
  );
  await douyinContext.addCookies(toPwCookies(douyinCookies));

  const douyinPage = await douyinContext.newPage();

  try {
    await douyinPage.goto('https://www.douyin.com/user/MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await douyinPage.waitForTimeout(2000);

    const douyinScreenshot = await douyinPage.screenshot({ fullPage: false, type: 'png' });
    fs.writeFileSync('/tmp/douyin-mobile.png', douyinScreenshot);

    const douyinContent = await douyinPage.content();
    const douyinHasProfile = douyinContent.includes('关注') || douyinContent.includes('粉丝') || douyinContent.includes('获赞');

    console.log(`  状态: ${douyinHasProfile ? '✅ 已登录' : '❌ 未登录'}`);
    console.log(`  截图: /tmp/douyin-mobile.png\n`);
  } catch (error: any) {
    console.log(`  ❌ 错误: ${error.message}\n`);
  }

  await douyinContext.close();
  await browser.close();

  console.log('✅ 测试完成！');
}

testMobileConfig().catch(console.error);
