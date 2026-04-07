/**
 * 小红书：仅支持分享短链直达截图，不做二次跳转。
 * 策略：打开分享链接 → 等待 2s（modal 尚未弹出）→ 立即截图 → 返回。
 */
import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { CHROME_HEADLESS_BASE_ARGS, resolveChromePath } from '@/lib/playwrightChrome';

async function scrapeProfileExcerpt(page: Page): Promise<string> {
  const title = await page.title();

  const coreText = await page.evaluate(() => {
    const skipSelectors = [
      'nav', 'header', 'footer',
      '[class*="sidebar"]', '[class*="nav"]', '[class*="menu"]',
      '[class*="footer"]', '[class*="legal"]', '[class*="icp"]',
    ];
    const skipEls = new Set<Element>();
    skipSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => skipEls.add(el));
    });

    function getTextSkipping(el: Element): string {
      if (skipEls.has(el)) return '';
      const parts: string[] = [];
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = child.textContent?.trim();
          if (t) parts.push(t);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          parts.push(getTextSkipping(child as Element));
        }
      }
      return parts.join(' ');
    }

    const main = document.querySelector('main') || document.querySelector('#app') || document.body;
    return getTextSkipping(main).replace(/\s+/g, ' ').trim().slice(0, 3000);
  }).catch(() => '');

  if (coreText.length > 80) {
    return ['标题: ' + title, coreText].join('\n');
  }

  const body = (await page.locator('body').innerText({ timeout: 8000 }).catch(() => ''))
    .replace(/\s+/g, ' ')
    .trim();

  const cutPatterns = [/沪ICP/, /京ICP/, /粤ICP/, /营业执照/, /增值电信业务/];
  let cut = body.length;
  for (const pat of cutPatterns) {
    const idx = body.search(pat);
    if (idx > 200 && idx < cut) cut = idx;
  }

  const cleaned = body.slice(0, cut).trim().slice(0, 3000);
  return ['标题: ' + title, cleaned].filter(Boolean).join('\n');
}

export type XhsDirectOpenOutcome = {
  ok: boolean;
  profileUrl?: string;
  profileExcerpt?: string;
  screenshotDataUrl?: string;
  error?: string;
};

/**
 * 打开分享短链，在登录 modal 弹出前（约 2s 内）截图，不做任何二次跳转。
 */
export async function xhsOpenEntryUrlAndProfileExcerpt(options: {
  entryUrl: string;
  headless?: boolean;
  screenshotDir?: string;
  captureScreenshot?: boolean;
}): Promise<XhsDirectOpenOutcome> {
  const { entryUrl, headless = true, screenshotDir, captureScreenshot = false } = options;
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      executablePath: resolveChromePath(),
      headless,
      args: [...CHROME_HEADLESS_BASE_ARGS],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'zh-CN',
    });

    const page = await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // @ts-ignore
      if (!window.chrome) {
        // @ts-ignore
        window.chrome = {
          runtime: {
            onConnect: { addListener: () => {} },
            onMessage: { addListener: () => {} },
          },
        };
      }
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ];
          Object.defineProperty(arr, 'item', { value: (i: number) => arr[i] });
          Object.defineProperty(arr, 'namedItem', { value: (n: string) => arr.find(p => p.name === n) || null });
          Object.defineProperty(arr, 'refresh', { value: () => {} });
          return arr;
        },
      });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
      try {
        // @ts-ignore
        if (Notification && Notification.permission === 'denied') {
          Object.defineProperty(Notification, 'permission', { get: () => 'default' });
        }
      } catch { /* ignore */ }
    });

    // 打开分享链接，等 DOM 内容加载完毕（JS 开始执行，但 modal 还未来得及弹出）
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // 立刻截图（0ms 等待）：domcontentloaded 后内容已在 DOM，modal 定时器尚未触发
    const earlyBuf = await page.screenshot({ fullPage: false, type: 'jpeg' }).catch(() => null);

    // 等待其余资源（图片等）加载，同时尝试关闭可能弹出的 modal
    await page.waitForTimeout(2000);
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const closeBtn = page.locator(
        '[class*="close" i], [class*="Close" i], [aria-label="关闭"], [aria-label="close" i], ' +
        'button:has-text("×"), button:has-text("✕")'
      ).first();
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch { /* ignore */ }

    const lateBuf = await page.screenshot({ fullPage: false, type: 'jpeg' }).catch(() => null);

    // 用内容更多的那张（文件更大 = 加载了更多图片内容）
    const buf = (() => {
      if (!earlyBuf) return lateBuf;
      if (!lateBuf) return earlyBuf;
      return lateBuf.length > earlyBuf.length * 1.1 ? lateBuf : earlyBuf;
    })();

    let screenshotDataUrl: string | undefined;
    if (buf) {
      if (captureScreenshot) {
        screenshotDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        fs.writeFileSync(path.join(screenshotDir, `xhs_direct_${ts}.jpg`), buf);
      }
    }

    const finalUrl = page.url();
    const profileUrl = finalUrl.split('?')[0];
    const profileExcerpt = await scrapeProfileExcerpt(page);

    await browser.close();
    browser = undefined;

    // 检测是否落在登录页（分享链接失效或被强制跳转）
    const looksLikeLogin =
      /\/login/i.test(finalUrl) ||
      /手机号登录|获取验证码|登录后推荐|我已阅读并同意.*用户协议/i.test(profileExcerpt) ||
      (/创作中心.*业务合作.*发现.*直播|发现\s*直播\s*发布\s*通知\s*登录/.test(profileExcerpt) &&
        !/粉丝|关注|获赞|笔记/.test(profileExcerpt));

    if (looksLikeLogin) {
      return {
        ok: false,
        profileUrl,
        profileExcerpt,
        screenshotDataUrl,
        error: '分享链接跳转到登录页，截图已保留供视觉分析',
      };
    }

    const ok = profileExcerpt.length >= 40;
    return {
      ok,
      profileUrl,
      profileExcerpt,
      screenshotDataUrl,
      error: ok ? undefined : '页面正文过短，可能未进入有效主页',
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await browser?.close();
    return { ok: false, error: msg };
  }
}
