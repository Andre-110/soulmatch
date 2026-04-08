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

async function testCookieValidity() {
  console.log('🧪 测试 Cookie 有效性（使用原始代码逻辑）\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 测试小红书
  console.log('📱 测试小红书...');
  const xhsContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
    fs.writeFileSync('/tmp/xhs-original-logic.png', xhsScreenshot);

    // 检查页面内容
    const xhsContent = await xhsPage.content();
    const xhsTitle = await xhsPage.title();

    // 检测登录页特征
    const hasLoginKeywords = xhsContent.includes('登录') ||
                             xhsContent.includes('该内容无法展示') ||
                             xhsContent.includes('安全限制') ||
                             xhsContent.includes('去登录');

    // 检测有效内容特征
    const hasValidContent = xhsContent.includes('关注') &&
                           xhsContent.includes('粉丝') &&
                           !hasLoginKeywords;

    console.log(`  页面标题: ${xhsTitle}`);
    console.log(`  有登录关键词: ${hasLoginKeywords ? '是' : '否'}`);
    console.log(`  有有效内容: ${hasValidContent ? '是' : '否'}`);
    console.log(`  Cookie 状态: ${hasValidContent ? '✅ 有效' : '❌ 失效'}`);
    console.log(`  截图: /tmp/xhs-original-logic.png\n`);
  } catch (error: any) {
    console.log(`  ❌ 错误: ${error.message}\n`);
  }

  await xhsContext.close();

  // 测试抖音
  console.log('📱 测试抖音...');
  const douyinContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'zh-CN',
  });

  const douyinCookiePath =
    [path.join(process.cwd(), '..', '..', 'cookies (20).json'), path.join(process.cwd(), '..', '..', 'cookies (19).json')].find((p) =>
      fs.existsSync(p),
    );
  if (!douyinCookiePath) throw new Error('未找到 cookies (20).json 或 cookies (19).json');
  const douyinCookies = JSON.parse(fs.readFileSync(douyinCookiePath, 'utf-8'));
  await douyinContext.addCookies(toPwCookies(douyinCookies));

  const douyinPage = await douyinContext.newPage();

  try {
    await douyinPage.goto('https://www.douyin.com/user/MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await douyinPage.waitForTimeout(2000);

    const douyinScreenshot = await douyinPage.screenshot({ fullPage: false, type: 'png' });
    fs.writeFileSync('/tmp/douyin-original-logic.png', douyinScreenshot);

    const douyinContent = await douyinPage.content();
    const douyinTitle = await douyinPage.title();

    const hasLoginKeywords = douyinContent.includes('登录') ||
                             douyinContent.includes('验证') ||
                             douyinContent.includes('扫码');

    const hasValidContent = douyinContent.includes('关注') &&
                           douyinContent.includes('粉丝') &&
                           !hasLoginKeywords;

    console.log(`  页面标题: ${douyinTitle}`);
    console.log(`  有登录关键词: ${hasLoginKeywords ? '是' : '否'}`);
    console.log(`  有有效内容: ${hasValidContent ? '是' : '否'}`);
    console.log(`  Cookie 状态: ${hasValidContent ? '✅ 有效' : '❌ 失效'}`);
    console.log(`  截图: /tmp/douyin-original-logic.png\n`);
  } catch (error: any) {
    console.log(`  ❌ 错误: ${error.message}\n`);
  }

  await douyinContext.close();
  await browser.close();

  console.log('✅ 测试完成！');
  console.log('\n💡 结论：');
  console.log('- 原始代码只检查截图是否成功（技术层面）');
  console.log('- 不检查截图内容是否有效（业务层面）');
  console.log('- 需要添加内容有效性检测');
}

testCookieValidity().catch(console.error);
