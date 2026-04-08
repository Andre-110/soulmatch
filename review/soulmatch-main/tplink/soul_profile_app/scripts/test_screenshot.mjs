import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const COOKIES_DIR = path.join(process.cwd(), '..', 'cookies');
const COOKIE_FILES = {
  xhs:     'cookies (6).json',
  weibo:   'cookies (7).json',
  douyin:  'cookies (19).json',
  netease: 'cookies (9).json',
  douban:  'cookies (10).json',
};

function loadCookies(platform) {
  const file = path.join(COOKIES_DIR, COOKIE_FILES[platform]);
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function toPwCookies(raw) {
  return raw
    .filter(c => c.name && c.value && c.domain)
    .map(c => ({
      name: c.name, value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || '/',
      secure: c.secure ?? false,
      httpOnly: c.httpOnly ?? false,
      sameSite: ['Strict','Lax','None'].includes(c.sameSite) ? c.sameSite : 'None',
      expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
    }));
}

const TESTS = [
  { platform: 'xhs',     url: 'https://www.xiaohongshu.com/user/profile/416227302' },
  { platform: 'douyin',  url: 'https://www.douyin.com/user/self' },
  { platform: 'weibo',   url: 'https://weibo.com/u/7487955617' },
  { platform: 'douban',  url: 'https://www.douban.com/people/225574042/' },
  { platform: 'netease', url: 'https://music.163.com/#/user/home?id=530688535' },
];

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const t of TESTS) {
  console.log(`\n【${t.platform}】截图中...`);
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      locale: 'zh-CN',
    });
    await context.addCookies(toPwCookies(loadCookies(t.platform)));
    const page = await context.newPage();
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    const outFile = `scripts/screenshot_${t.platform}.png`;
    fs.writeFileSync(outFile, buf);
    console.log(`  ✓ 截图保存到 ${outFile}（${buf.length} bytes）`);
    await context.close();
  } catch(e) {
    console.log(`  ✗ 失败: ${e.message}`);
  }
}

await browser.close();
