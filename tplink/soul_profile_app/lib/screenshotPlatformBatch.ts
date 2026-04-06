import { BrowserContext } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { screenshotTargetUrl, type PlatformKey } from '@/lib/platformUrls';
import { findCookieFilePath, findDouyinCookieFilePath } from '@/lib/cookieFilePaths';
import { browserPool } from '@/lib/browserPool';
import {
  extensionCookiesToPlaywright,
  type BrowserExtensionCookie,
} from '@/lib/browserExtensionCookies';

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

/** 截图前检测：有文件不等于有有效主页（错误页也会被截进图） */
function detectUnusablePageText(text: string, title?: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, 16000);
  const titleLower = (title ?? '').toLowerCase();

  if (/未连接到服务器|未连接到网络|网络连接失败|请检查网络|网络异常/.test(t)) {
    return '页面为网络/连接错误提示（非有效主页内容）';
  }
  // 全角/半角逗号均兼容
  if (/很抱歉.{0,2}你要查找的网页找不到|404 not found/i.test(t) ||
      /很抱歉.{0,2}你要查找的网页找不到/.test(titleLower)) {
    return '页面为 404（链接或用户 id 无效；网易云请确认 id）';
  }
  // 验证码：innerText 可能拿不到 overlay，通过标题/页面文字双重检测
  if (/请完成下列验证|拖动完成|拼图|滑块|安全验证|按住.*按钮/.test(t) ||
      /验证|captcha/i.test(titleLower)) {
    return '页面为人机验证，无法自动获取内容';
  }
  return null;
}

export type ScreenshotResult = {
  ok: boolean;
  dataUrl?: string;
  error?: string;
};

export type ScreenshotTask = {
  platform: PlatformKey;
  extractedId: string;
};

/**
 * 批量截图：复用浏览器实例，串行处理多个平台
 * 优化点：
 * 1. 只启动一次浏览器
 * 2. 每个平台创建独立 context（隔离 cookie）
 * 3. 串行执行避免 CPU 打满
 * 4. 使用 JPEG 压缩减少体积
 */
export async function screenshotMultiplePlatforms(
  tasks: ScreenshotTask[],
  screenshotDir?: string
): Promise<Map<PlatformKey, ScreenshotResult>> {
  const results = new Map<PlatformKey, ScreenshotResult>();

  if (tasks.length === 0) return results;

  // 如果提供了 screenshotDir，创建目录
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    console.log(`[Screenshot] 截图将保存到: ${screenshotDir}`);
  }

  const browser = await browserPool.getBrowser();

  for (const task of tasks) {
    const { platform, extractedId } = task;
    const url = screenshotTargetUrl(platform, extractedId);
    const rawCookies = loadCookies(platform);

    console.log(`[Screenshot] 开始截图: ${platform} - ${url}`);

    if (rawCookies.length === 0) {
      console.log(`[Screenshot] ❌ ${platform}: 未找到 cookie 文件`);
      results.set(platform, {
        ok: false,
        error: `未找到 ${platform} 的 cookie 文件`,
      });
      continue;
    }

    let context: BrowserContext | null = null;
    try {
      // 为每个平台创建独立 context
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 }, // 降低分辨率
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        locale: 'zh-CN',
        // 注入中文字体样式
        extraHTTPHeaders: {
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      await context.addCookies(extensionCookiesToPlaywright(rawCookies));

      const page = await context.newPage();

      // 针对抖音和小红书，添加更多反检测措施
      if (platform === 'douyin' || platform === 'xhs') {
        await page.addInitScript(() => {
          // 隐藏 webdriver 特征
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          // 伪装 Chrome
          Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
          Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
        });
      }

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 等待页面初始加载（抖音和小红书需要更长时间）
      const waitTime = (platform === 'douyin' || platform === 'xhs') ? 5000 : 3000;
      await page.waitForTimeout(waitTime);

      // 尝试等待内容加载（失败不影响截图）
      try {
        await Promise.race([
          page.waitForSelector('img', { timeout: 3000 }),
          page.waitForSelector('[class*="content"]', { timeout: 3000 }),
          page.waitForSelector('[class*="profile"]', { timeout: 3000 }),
        ]);
      } catch {
        // 忽略
      }

      // 滑动页面加载更多内容
      console.log(`[Screenshot] ${platform}: 开始滑动加载更多内容...`);

      // 针对不同平台使用不同的滑动策略
      const scrollTimes = (platform === 'douyin' || platform === 'xhs') ? 5 : 3;
      const scrollDelay = (platform === 'douyin' || platform === 'xhs') ? 2000 : 1500;

      for (let i = 0; i < scrollTimes; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 0.8);
        });
        await page.waitForTimeout(scrollDelay); // 等待内容加载
      }

      // 滚动回顶部
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);

      const bodyText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
      const pageTitle = await page.title().catch(() => '');
      const unusableReason = detectUnusablePageText(bodyText, pageTitle);

      const buf = await page.screenshot({
        fullPage: true,
        type: 'jpeg',
        quality: 80,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      if (screenshotDir) {
        const filename = unusableReason
          ? `bad_${platform}_${timestamp}.jpg`
          : `${platform}_${timestamp}.jpg`;
        const filepath = path.join(screenshotDir, filename);
        fs.writeFileSync(filepath, buf);
        console.log(
          `[Screenshot] 已保存: ${filepath}${unusableReason ? ` (${unusableReason})` : ''}`,
        );
      }

      if (unusableReason) {
        throw new Error(unusableReason);
      }

      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

      results.set(platform, { ok: true, dataUrl });
    } catch (e: any) {
      console.log(`[Screenshot] ❌ ${platform} 失败: ${e?.message ?? String(e)}`);
      results.set(platform, {
        ok: false,
        error: e?.message ?? String(e),
      });
    } finally {
      // 关闭 context 释放资源
      if (context) {
        await context.close().catch(() => {});
      }
    }
  }

  return results;
}
