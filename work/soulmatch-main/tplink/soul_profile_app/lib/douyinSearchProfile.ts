/**
 * 登录 Cookie 下：打开抖音搜索用户，进入用户主页抓取数据。
 */
import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type Page } from 'playwright-core';
import {
  extensionCookiesToPlaywright,
  readBrowserExtensionCookiesFromFile,
} from '@/lib/browserExtensionCookies';
import { CHROME_HEADLESS_BASE_ARGS, resolveChromePath } from '@/lib/playwrightChrome';

export type DouyinUserCard = {
  userId?: string;
  nickname?: string;
  signature?: string;
  followerCount?: number;
  followingCount?: number;
  awemeCount?: number;
  raw?: unknown;
};

/** 无法继续抓取时的归类（与截图现象对应） */
export type DouyinBlockReason =
  | 'captcha'
  | 'login_required'
  | 'loading_or_empty'
  | 'unknown';

export type DouyinSearchProfileOutcome = {
  ok: boolean;
  keyword: string;
  searchUrl: string;
  users: DouyinUserCard[];
  profileUrl?: string;
  profileExcerpt?: string;
  screenshots?: { search?: string; profile?: string };
  error?: string;
  /** 未拿到用户列表时，说明被拦原因 */
  blockReason?: DouyinBlockReason;
  /** 简短说明，便于日志与排障 */
  pageHint?: string;
};

export type DouyinSearchProfileOptions = {
  cookiePath: string;
  keyword: string;
  openFirstProfile?: boolean;
  screenshotDir?: string;
  headless?: boolean;
};

/**
 * 根据正文判断：验证码 / 登录页 / 白屏加载（与 debug 截图一致）。
 */
async function detectDouyinBlock(page: Page): Promise<{
  blocked: boolean;
  reason?: DouyinBlockReason;
  hint: string;
}> {
  let text = '';
  try {
    text = (await page.locator('body').innerText({ timeout: 10000 })).slice(0, 12000);
  } catch {
    return { blocked: true, reason: 'loading_or_empty', hint: '无法读取页面正文（超时或未渲染）' };
  }
  const t = text.replace(/\s+/g, ' ').trim();

  if (
    /请完成下列验证|拖动完成|拼图|滑块|安全验证|captcha|verify/i.test(t) ||
    (t.includes('验证') && t.includes('继续') && t.length < 3000)
  ) {
    return { blocked: true, reason: 'captcha', hint: '人机验证（滑块/拼图），自动化无法通过' };
  }
  if (
    /扫码登录|短信登录|请登录|立即登录|手机号登录/.test(t) &&
    !/关注|粉丝|获赞|作品/.test(t)
  ) {
    return { blocked: true, reason: 'login_required', hint: '页面要求登录，Cookie 可能失效或未带上' };
  }
  if (t.length < 120 && !/抖音|搜索|推荐/.test(t)) {
    return { blocked: true, reason: 'loading_or_empty', hint: '正文过短，多为灰屏加载未完成或脚本过早截图' };
  }
  return { blocked: false, hint: '' };
}

async function scrapeProfileExcerpt(page: Page): Promise<string> {
  const title = await page.title();
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 4500);
  return ['标题: ' + title, body].filter(Boolean).join('\n');
}

async function clickUserTab(page: Page): Promise<void> {
  const candidates = [
    page.getByRole('tab', { name: '用户' }),
    page.locator('div[class*="tab"]').filter({ hasText: /^用户$/ }),
    page.locator('span').filter({ hasText: /^用户$/ }).first(),
  ];
  for (const loc of candidates) {
    try {
      await loc.click({ timeout: 4000 });
      await page.waitForTimeout(1500);
      return;
    } catch {
      /* try next */
    }
  }
}

async function collectUsersFromDom(page: Page): Promise<DouyinUserCard[]> {
  return page.$$eval('a[href*="/user/"]', (els) => {
    const cards: { userId: string; nickname?: string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < els.length; i++) {
      const a = els[i];
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/user\/([A-Za-z0-9_-]+)/);
      if (!m) continue;
      const userId = m[1];
      if (seen.has(userId)) continue;
      seen.add(userId);
      cards.push({ userId, nickname: (a.textContent || '').trim() || undefined });
    }
    return cards;
  });
}

export async function douyinSearchUsersAndProfileInfo(
  options: DouyinSearchProfileOptions,
): Promise<DouyinSearchProfileOutcome> {
  const {
    cookiePath,
    keyword,
    openFirstProfile = true,
    screenshotDir,
    headless = true,
  } = options;

  const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=user`;

  if (!fs.existsSync(cookiePath)) {
    return {
      ok: false,
      keyword,
      searchUrl,
      users: [],
      error: `Cookie 文件不存在: ${cookiePath}`,
    };
  }

  const rawCookies = readBrowserExtensionCookiesFromFile(cookiePath);
  if (rawCookies.length === 0) {
    return { ok: false, keyword, searchUrl, users: [], error: 'Cookie 文件为空' };
  }

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
    await context.addCookies(extensionCookiesToPlaywright(rawCookies));
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    });

    // 先访问首页建立会话
    await page.goto('https://www.douyin.com/', {
      waitUntil: 'networkidle',
      timeout: 90000,
    });
    await page.waitForTimeout(2500);

    let homeBlock = await detectDouyinBlock(page);
    if (homeBlock.blocked && homeBlock.reason === 'captcha') {
      await browser.close();
      browser = undefined;
      return {
        ok: false,
        keyword,
        searchUrl,
        users: [],
        blockReason: 'captcha',
        pageHint: homeBlock.hint,
        error: homeBlock.hint,
      };
    }

    // 搜索页：networkidle 更易等到接口渲染；仍可能长时间灰屏
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(5000);

    let searchBlock = await detectDouyinBlock(page);
    if (searchBlock.blocked && searchBlock.reason === 'captcha') {
      const tsEarly = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let screenshots: { search?: string } | undefined;
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        const p = path.join(screenshotDir, `douyin_search_users_${tsEarly}.png`);
        await page.screenshot({ path: p, fullPage: false });
        screenshots = { search: p };
      }
      await browser.close();
      browser = undefined;
      return {
        ok: false,
        keyword,
        searchUrl,
        users: [],
        blockReason: 'captcha',
        pageHint: searchBlock.hint,
        error: searchBlock.hint,
        screenshots,
      };
    }

    // 若仍像白屏，再等一轮
    if (searchBlock.blocked && searchBlock.reason === 'loading_or_empty') {
      await page.waitForTimeout(10000);
      searchBlock = await detectDouyinBlock(page);
    }

    if (searchBlock.blocked && searchBlock.reason === 'login_required') {
      const tsLogin = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      let screenshotsLogin: { search?: string } | undefined;
      if (screenshotDir) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        const p = path.join(screenshotDir, `douyin_search_users_${tsLogin}.png`);
        await page.screenshot({ path: p, fullPage: false });
        screenshotsLogin = { search: p };
      }
      await browser.close();
      browser = undefined;
      return {
        ok: false,
        keyword,
        searchUrl,
        users: [],
        blockReason: 'login_required',
        pageHint: searchBlock.hint,
        error: searchBlock.hint,
        screenshots: screenshotsLogin,
      };
    }

    // 尝试点击用户标签
    await clickUserTab(page);
    await page.waitForTimeout(4000);

    let users = await collectUsersFromDom(page);
    users = users.filter((u) => u.userId && u.userId !== 'self');

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let screenshots: { search?: string; profile?: string } | undefined;
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      const searchShot = path.join(screenshotDir, `douyin_search_users_${ts}.png`);
      await page.screenshot({ path: searchShot, fullPage: false });
      screenshots = { search: searchShot };
    }

    let profileUrl: string | undefined;
    let profileExcerpt: string | undefined;

    if (openFirstProfile && users.length > 0) {
      const pick = users[0];
      if (pick?.userId) {
        profileUrl = `https://www.douyin.com/user/${pick.userId}`;
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        profileExcerpt = await scrapeProfileExcerpt(page);
        if (screenshotDir && screenshots) {
          const profileShot = path.join(
            screenshotDir,
            `douyin_profile_${pick.userId}_${ts}.png`,
          );
          await page.screenshot({ path: profileShot, fullPage: false });
          screenshots.profile = profileShot;
        }
      }
    }

    const success = users.length > 0 || Boolean(profileExcerpt);
    if (!success) {
      const final = await detectDouyinBlock(page);
      await browser.close();
      browser = undefined;
      return {
        ok: false,
        keyword,
        searchUrl,
        users,
        screenshots,
        blockReason: final.blocked ? final.reason ?? 'unknown' : 'unknown',
        pageHint: final.blocked ? final.hint : '未解析到用户链接，可能仍在灰屏、验证码未识别或页面改版',
        error:
          final.blocked && final.hint
            ? final.hint
            : '未获取到用户列表：请查看截图是否为验证码/灰屏/登录页',
      };
    }

    await browser.close();
    browser = undefined;

    return {
      ok: true,
      keyword,
      searchUrl,
      users,
      profileUrl,
      profileExcerpt,
      screenshots,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await browser?.close();
    return {
      ok: false,
      keyword,
      searchUrl,
      users: [],
      error: msg,
    };
  }
}
