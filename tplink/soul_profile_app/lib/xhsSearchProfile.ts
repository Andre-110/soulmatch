/**
 * 小红书：仅支持分享短链 / 个人主页 URL 直达（不注入 Cookie、不搜索）。
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
  screenshotDataUrl?: string;  // base64 JPEG data URL（仅当 captureScreenshot=true 时返回）
  error?: string;
};

/**
 * 打开分享短链或主页 URL，跟随跳转后抓取用户主页正文（无 Cookie）。
 * captureScreenshot=true 时同时截图并在 screenshotDataUrl 返回 base64 JPEG。
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
    await page.goto(entryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    let finalUrl = page.url();
    if (!/\/user\/profile\/[a-f0-9]{24}/i.test(finalUrl)) {
      const href = await page
        .locator('a[href*="/user/profile/"]')
        .first()
        .getAttribute('href')
        .catch(() => null);
      if (href) {
        const abs = new URL(href, finalUrl).href;
        await page.goto(abs, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(4000);
        finalUrl = page.url();
      }
    }

    let profileUrl = finalUrl.split('?')[0];
    const m = profileUrl.match(/\/user\/profile\/([a-f0-9]{24})/i);
    if (m) {
      profileUrl = `https://www.xiaohongshu.com/user/profile/${m[1]}`;
    }

    const profileExcerpt = await scrapeProfileExcerpt(page);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // 截图（向下滚动一次，保证笔记区域可见）
    let screenshotDataUrl: string | undefined;
    if (captureScreenshot || screenshotDir) {
      try {
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(800);
      } catch { /* ignore */ }
      const buf = await page.screenshot({ fullPage: false, type: 'jpeg' });
      if (captureScreenshot) {
        screenshotDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        fs.writeFileSync(path.join(screenshotDir, `xhs_direct_${ts}.jpg`), buf);
      }
    }

    await browser.close();
    browser = undefined;

    const looksLikeLogin =
      /\/login/i.test(finalUrl) ||
      /手机号登录|获取验证码|登录后推荐|我已阅读并同意.*用户协议/i.test(profileExcerpt);
    if (looksLikeLogin) {
      return {
        ok: false,
        profileUrl: finalUrl.split('?')[0],
        profileExcerpt,
        error: '页面为登录页或未展开主页（可检查短链解析是否得到带 token 的主页 URL）',
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
