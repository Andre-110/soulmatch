import { chromium } from 'playwright-core';
import fs from 'fs';
import { screenshotTargetUrl, type PlatformKey } from '@/lib/platformUrls';
import { findCookieFilePath, findDouyinCookieFilePath } from '@/lib/cookieFilePaths';
import {
  extensionCookiesToPlaywright,
  type BrowserExtensionCookie,
} from '@/lib/browserExtensionCookies';
import { CHROME_HEADLESS_BASE_ARGS, resolveChromePath } from '@/lib/playwrightChrome';

const COOKIE_FILES: Record<PlatformKey, string> = {
  xhs:     'cookies (6).json',
  weibo:   'cookies (7).json',
  douyin:  'cookies (20).json',
  netease: 'cookies (9).json',
  douban:  'cookies (10).json',
  zhihu:   'cookies (11).json',
};

function loadCookies(platform: PlatformKey): BrowserExtensionCookie[] {
  try {
    const file =
      platform === 'douyin' ? findDouyinCookieFilePath() : findCookieFilePath(COOKIE_FILES[platform]);
    if (!file) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as BrowserExtensionCookie[];
  } catch {
    return [];
  }
}

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
  const url = screenshotTargetUrl(platform, extractedId);
  const rawCookies = loadCookies(platform);
  if (rawCookies.length === 0) {
    return { ok: false, error: `未找到 ${platform} 的 cookie 文件` };
  }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: resolveChromePath(),
      headless: true,
      args: [...CHROME_HEADLESS_BASE_ARGS],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },  // iPhone 尺寸，适合移动端页面
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      locale: 'zh-CN',
    });

    await context.addCookies(extensionCookiesToPlaywright(rawCookies));

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
