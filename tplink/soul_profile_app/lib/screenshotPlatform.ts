import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import type { PlatformKey } from '@/lib/platformUrls';

/** 运行时读取，避免 import 早于 dotenv / systemd 注入 */
function resolveChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return '/usr/bin/google-chrome';
}

function resolveCookiesDir(): string {
  return process.env.COOKIES_DIR ?? path.join(process.cwd(), '..', 'cookies');
}

const COOKIE_FILES: Record<PlatformKey, string> = {
  xhs:     'cookies (6).json',
  weibo:   'cookies (7).json',
  douyin:  'cookies (8).json',
  netease: 'cookies (9).json',
  douban:  'cookies (10).json',
};

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

function loadCookies(platform: PlatformKey): RawCookie[] {
  try {
    const file = path.join(resolveCookiesDir(), COOKIE_FILES[platform]);
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as RawCookie[];
  } catch {
    return [];
  }
}

/** 把 Chrome 插件导出格式转成 Playwright 格式 */
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

const PLATFORM_URLS: Record<PlatformKey, (id: string) => string> = {
  weibo:   (id) => `https://weibo.com/u/${id}`,
  xhs:     (id) => `https://www.xiaohongshu.com/user/profile/${id}`,
  douyin:  (id) => id && id !== 'self' ? `https://www.douyin.com/user/${id}` : `https://www.douyin.com/user/self`,
  netease: (id) => `https://music.163.com/#/user/home?id=${id}`,
  douban:  (id) => `https://www.douban.com/people/${id}/`,
};

export type ScreenshotResult = {
  ok: boolean;
  dataUrl?: string;   // base64 PNG data URL
  error?: string;
};

/**
 * 用 Playwright 启动 Chrome，注入 cookie，截取平台主页。
 * @param platform  平台 key
 * @param extractedId  平台用户 ID（从 profileUrl 解析出的）
 */
export async function screenshotPlatformPage(
  platform: PlatformKey,
  extractedId: string,
): Promise<ScreenshotResult> {
  const url = PLATFORM_URLS[platform](extractedId);
  const rawCookies = loadCookies(platform);
  if (rawCookies.length === 0) {
    return { ok: false, error: `未找到 ${platform} 的 cookie 文件` };
  }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: resolveChromePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },  // iPhone 尺寸，适合移动端页面
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      locale: 'zh-CN',
    });

    await context.addCookies(toPwCookies(rawCookies));

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // 等待主体内容出现（各平台不同，统一等 2s 兜底）
    await page.waitForTimeout(2000);

    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    return { ok: true, dataUrl };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  } finally {
    await browser?.close();
  }
}
