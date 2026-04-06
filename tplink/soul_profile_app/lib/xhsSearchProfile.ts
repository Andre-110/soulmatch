/**
 * 登录 Cookie 下：打开小红书「用户」搜索结果页，合并 edith API + DOM，再进入目标用户主页抓正文摘要。
 */
import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type Page } from 'playwright-core';
import {
  extensionCookiesToPlaywright,
  readBrowserExtensionCookiesFromFile,
} from '@/lib/browserExtensionCookies';
import { CHROME_HEADLESS_BASE_ARGS, resolveChromePath } from '@/lib/playwrightChrome';

// --- 对外类型 ---

export type XhsUserCard = {
  userId?: string;
  nickname?: string;
  redId?: string;
  desc?: string;
  fans?: string;
  raw?: unknown;
};

export type XhsSearchProfileOutcome = {
  ok: boolean;
  keyword: string;
  searchUrl: string;
  users: XhsUserCard[];
  profileUrl?: string;
  profileExcerpt?: string;
  screenshots?: { search?: string; profile?: string };
  error?: string;
};

export type XhsSearchProfileOptions = {
  cookiePath: string;
  keyword: string;
  openFirstProfile?: boolean;
  preferUserId?: string;
  screenshotDir?: string;
  headless?: boolean;
};

// --- edith / DOM 解析 ---

function extractUsersFromEdithJson(data: unknown): XhsUserCard[] {
  const out: XhsUserCard[] = [];
  const d = data as Record<string, unknown>;
  const payload = d?.data ?? d;
  const list =
    (payload as { users?: unknown }).users ??
    (payload as { user_list?: unknown }).user_list ??
    (payload as { items?: unknown }).items ??
    (payload as { search_user_list?: unknown }).search_user_list ??
    [];
  if (!Array.isArray(list)) return out;

  for (const item of list) {
    const row = item as Record<string, unknown>;
    const u = row.user ?? item;
    if (!u && typeof item === 'object') {
      const id = row.user_id ?? row.id ?? row.userid;
      if (id) {
        out.push({
          userId: String(id),
          nickname: (row.nickname ?? row.user_name) as string | undefined,
          redId: row.red_id as string | undefined,
          desc: row.desc as string | undefined,
          raw: item,
        });
      }
      continue;
    }
    if (u && typeof u === 'object') {
      const user = u as Record<string, unknown>;
      const uid = user.user_id ?? user.id;
      out.push({
        userId: uid != null ? String(uid) : undefined,
        nickname: (user.nickname ?? user.nick_name) as string | undefined,
        redId: user.red_id as string | undefined,
        desc: user.desc as string | undefined,
        fans: user.fans != null ? String(user.fans) : undefined,
        raw: u,
      });
    }
  }
  return out;
}

function mergeUsers(...lists: XhsUserCard[][]): XhsUserCard[] {
  const seen = new Set<string>();
  const merged: XhsUserCard[] = [];
  for (const list of lists) {
    for (const u of list) {
      const id = u.userId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(u);
    }
  }
  return merged;
}

async function collectUsersFromDom(page: Page): Promise<XhsUserCard[]> {
  return page.$$eval('a[href*="/user/profile/"]', (els) => {
    const cards: { userId: string; nickname?: string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < els.length; i++) {
      const a = els[i];
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
      if (!m) continue;
      const userId = m[1];
      if (seen.has(userId)) continue;
      seen.add(userId);
      cards.push({ userId, nickname: (a.textContent || '').trim() || undefined });
    }
    return cards;
  });
}

function pickTargetUser(users: XhsUserCard[], keyword: string): XhsUserCard | undefined {
  if (users.length === 0) return undefined;
  const byKeyword = users.find(
    (u) =>
      u.nickname &&
      (u.nickname.includes(keyword) || u.nickname.includes('小红书号')),
  );
  if (byKeyword) return byKeyword;
  const notNav = users.filter((u) => u.nickname && u.nickname !== '我' && u.nickname.length > 2);
  return notNav[0] ?? users[0];
}

async function scrapeProfileExcerpt(page: Page): Promise<string> {
  const title = await page.title();

  // 使用 page.evaluate 直接提取 XHS 用户主页的核心文字，跳过侧边栏和页脚
  const coreText = await page.evaluate(() => {
    // 跳过侧边栏、导航、页脚等元素的 CSS class / id 关键字
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

  // 如果 evaluate 拿到足够内容就用它；否则回退 body.innerText + 去页脚
  if (coreText.length > 80) {
    return ['标题: ' + title, coreText].join('\n');
  }

  const body = (await page.locator('body').innerText({ timeout: 8000 }).catch(() => ''))
    .replace(/\s+/g, ' ')
    .trim();

  // 在第一个 ICP/营业执照 备案文字前截断
  const cutPatterns = [/沪ICP/, /京ICP/, /粤ICP/, /营业执照/, /增值电信业务/];
  let cut = body.length;
  for (const pat of cutPatterns) {
    const idx = body.search(pat);
    if (idx > 200 && idx < cut) cut = idx;   // 至少保留 200 字（跳过页面最顶部的简短法律文字）
  }

  const cleaned = body.slice(0, cut).trim().slice(0, 3000);
  return ['标题: ' + title, cleaned].filter(Boolean).join('\n');
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

function isEdithUserSearchUrl(url: string): boolean {
  return /usersearch|search\/user|\/users/i.test(url);
}

// --- 主流程 ---

export async function xhsSearchUsersAndProfileInfo(
  options: XhsSearchProfileOptions,
): Promise<XhsSearchProfileOutcome> {
  const {
    cookiePath,
    keyword,
    openFirstProfile = true,
    preferUserId,
    screenshotDir,
    headless = true,
  } = options;

  const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_explore_feed`;

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

  const apiBodies: { data: unknown }[] = [];
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

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('edith.xiaohongshu.com') || !isEdithUserSearchUrl(url)) return;
      try {
        const ct = response.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        apiBodies.push({ data: await response.json() });
      } catch {
        /* 非 JSON 或已读 */
      }
    });

    await page.goto('https://www.xiaohongshu.com/explore', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(1500);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await clickUserTab(page);
    await page.waitForTimeout(2500);

    let users: XhsUserCard[] = [];
    for (const { data } of apiBodies) {
      users = mergeUsers(users, extractUsersFromEdithJson(data));
    }
    users = mergeUsers(users, await collectUsersFromDom(page));

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let screenshots: { search?: string; profile?: string } | undefined;
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      const searchShot = path.join(screenshotDir, `xhs_search_users_${ts}.png`);
      await page.screenshot({ path: searchShot, fullPage: false });
      screenshots = { search: searchShot };
    }

    let profileUrl: string | undefined;
    let profileExcerpt: string | undefined;

    if (openFirstProfile && users.length > 0) {
      const pick =
        (preferUserId && users.find((u) => u.userId === preferUserId)) ||
        pickTargetUser(users, keyword);
      if (pick?.userId) {
        profileUrl = `https://www.xiaohongshu.com/user/profile/${pick.userId}`;
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);
        profileExcerpt = await scrapeProfileExcerpt(page);
        if (screenshotDir && screenshots) {
          const profileShot = path.join(
            screenshotDir,
            `xhs_profile_${pick.userId}_${ts}.png`,
          );
          await page.screenshot({ path: profileShot, fullPage: false });
          screenshots.profile = profileShot;
        }
      }
    }

    await browser.close();
    browser = undefined;

    return {
      ok: users.length > 0 || Boolean(profileExcerpt),
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
