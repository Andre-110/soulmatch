import * as cheerio from 'cheerio';
import type { PlatformKey } from '@/lib/platformUrls';
import { getCookieHeader } from '@/lib/loadCookies';
import { screenshotPlatformPage } from '@/lib/screenshotPlatform';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

export type ScrapeOutcome = {
  platform: PlatformKey;
  url: string;
  ok: boolean;
  excerpt: string;
  method?: string;
  screenshotDataUrl?: string; // base64 PNG，用于 GPT-4o 视觉分析
};

const PUBLIC_LABEL: Record<PlatformKey, string> = {
  weibo: '微博',
  xhs: '小红书',
  douyin: '抖音',
  netease: '网易云音乐',
  douban: '豆瓣',
};

export function scrapeOutcomeToDisplayName(o: ScrapeOutcome): string {
  return PUBLIC_LABEL[o.platform] || o.platform;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 18000
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

function clip(s: string, n = 5500): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** 常见登录 / 空壳页，摘录过短则视为无效 */
function looksLikeLoginOrShell(text: string): boolean {
  if (text.length < 40) return true;
  return /^(登录|扫码登录|短信登录|请登录|人机验证|验证失败|验证您|opps|403|429)/i.test(text.trim());
}

async function scrapeViaJinaReader(targetUrl: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${targetUrl.replace(/^\/+/, '')}`;
  try {
    const res = await fetchWithTimeout(
      jinaUrl,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'text/plain,text/markdown,*/*',
          'X-Return-Format': 'markdown',
        },
      },
      55000
    );
    if (!res.ok) return '';
    let text = await res.text();
    const idx = text.indexOf('Markdown Content:');
    if (idx !== -1) text = text.slice(idx + 'Markdown Content:'.length).trim();
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    if (looksLikeLoginOrShell(text)) return '';
    return clip(text, 5500);
  } catch {
    return '';
  }
}

async function scrapeHtmlDirect(pageUrl: string, cookie?: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(pageUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    const desc =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';
    $('script,noscript,style').remove();
    const body = $('body').text().replace(/\s+/g, ' ').trim();
    const chunk = [title, desc, body.slice(0, 4500)].filter(Boolean).join('\n');
    const out = clip(chunk, 5500);
    if (looksLikeLoginOrShell(out)) return '';
    return out;
  } catch {
    return '';
  }
}

async function directThenReader(url: string, cookie?: string): Promise<{ text: string; method: string }> {
  let text = await scrapeHtmlDirect(url, cookie);
  if (text.length >= 80) return { text, method: 'http-html' };
  const via = await scrapeViaJinaReader(url);
  if (via.length >= 40) return { text: via, method: 'reader-proxy' };
  if (text.length > 0) return { text, method: 'http-html' };
  return { text: '', method: 'none' };
}

/** weibo.com AJAX API（需登录 Cookie） */
export async function scrapeWeibo(uid: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('weibo');
  const ajaxHeaders = {
    'User-Agent': UA,
    Referer: 'https://weibo.com/',
    Accept: 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    Cookie: cookie,
  };
  try {
    const infoRes = await fetchWithTimeout(
      `https://weibo.com/ajax/profile/info?uid=${encodeURIComponent(uid)}`,
      { headers: ajaxHeaders },
    );
    if (infoRes.ok) {
      const infoData = (await infoRes.json()) as any;
      const u = infoData?.data?.user;
      if (u?.screen_name) {
        const parts: string[] = [
          `昵称：${u.screen_name}`,
          u.description && `简介：${u.description}`,
          u.verified_reason && `认证：${u.verified_reason}`,
          u.location && `地区：${u.location}`,
          u.followers_count != null && `粉丝数：${u.followers_count}`,
          u.friends_count != null && `关注数：${u.friends_count}`,
          u.statuses_count != null && `微博数：${u.statuses_count}`,
        ].filter(Boolean) as string[];
        try {
          const mbRes = await fetchWithTimeout(
            `https://weibo.com/ajax/statuses/mymblog?uid=${encodeURIComponent(uid)}&page=1&feature=0`,
            { headers: ajaxHeaders },
          );
          if (mbRes.ok) {
            const mbData = (await mbRes.json()) as any;
            const posts: string[] = ((mbData?.data?.list ?? []) as any[])
              .slice(0, 5)
              .map((p: any) => p.text_raw || p.text || '')
              .filter(Boolean);
            if (posts.length) parts.push(`\n最近微博（摘录）：\n${posts.join('\n')}`);
          }
        } catch { /* ignore */ }
        return { platform: 'weibo', url: profileUrl, ok: true, excerpt: clip(parts.join('\n')), method: 'weibo-ajax-api' };
      }
    }
  } catch { /* fall through */ }
  const { text, method } = await directThenReader(profileUrl, cookie);
  return { platform: 'weibo', url: profileUrl, ok: text.length >= 40, excerpt: text, method };
}

export async function scrapeDouban(peopleId: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('douban');
  const { text, method } = await directThenReader(profileUrl, cookie);
  return {
    platform: 'douban',
    url: profileUrl,
    ok: text.length >= 40,
    excerpt: text,
    method,
  };
}

export async function scrapeXhs(keyword: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('xhs');
  let excerpt = '';
  let fromSearch = false;

  try {
    const searchUrl = `https://edith.xiaohongshu.com/api/sns/web/v1/search/notes?keyword=${encodeURIComponent(keyword)}&page=1&page_size=5&search_id=&sort=general&note_type=0`;
    const res = await fetchWithTimeout(searchUrl, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.xiaohongshu.com/',
        Cookie: cookie,
        'Content-Type': 'application/json',
        'x-sign': 'X1',
      },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const items: any[] = data?.data?.items ?? [];
      if (items.length > 0) {
        const parts = items.slice(0, 5).map((item: any) => {
          const note = item?.note_card;
          return `标题：${note?.display_title ?? ''}  作者：${note?.user?.nickname ?? ''}`;
        }).filter(Boolean);
        if (parts.length) {
          excerpt = clip(parts.join('\n'));
          fromSearch = true;
        }
      }
    }
  } catch {
    /* fall through */
  }

  let result: ScrapeOutcome;
  if (fromSearch) {
    result = { platform: 'xhs', url: profileUrl, ok: true, excerpt, method: 'xhs-search-api' };
  } else {
    result = {
      platform: 'xhs',
      url: profileUrl,
      ok: false,
      excerpt: '',
      method: 'playwright-screenshot',
    };
  }

  result = await attachPlatformScreenshot(result, 'xhs', keyword);

  if (!fromSearch) {
    if (result.screenshotDataUrl) {
      result.ok = true;
      result.excerpt = '[截图已获取，交由视觉模型分析]';
    } else {
      result.excerpt = '小红书：搜索与截图均未取得有效内容';
      result.ok = false;
    }
  }

  return result;
}

export async function scrapeDouyin(secUid: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('douyin');
  const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const headers = { 'User-Agent': UA_MOBILE, Referer: 'https://www.douyin.com/', Cookie: cookie, Accept: 'application/json' };

  // 优先用 web API 获取用户信息（可通过 sec_uid 查任意用户）
  const apiUrl = secUid && secUid !== 'self'
    ? `https://www.douyin.com/aweme/v1/web/user/profile/other/?sec_user_id=${encodeURIComponent(secUid)}&aid=6383&cookie_enabled=1`
    : `https://www.douyin.com/aweme/v1/web/user/profile/self/?aid=6383&cookie_enabled=1`;
  try {
    const res = await fetchWithTimeout(apiUrl, { headers });
    if (res.ok) {
      const data = (await res.json()) as any;
      const u = data?.user;
      if (u?.nickname) {
        const parts: string[] = [
          `昵称：${u.nickname}`,
          u.signature && `简介：${u.signature}`,
          u.city && `城市：${u.city}`,
          u.follower_count != null && `粉丝数：${u.follower_count}`,
          u.following_count != null && `关注数：${u.following_count}`,
          u.aweme_count != null && `作品数：${u.aweme_count}`,
          u.total_favorited != null && `获赞数：${u.total_favorited}`,
        ].filter(Boolean) as string[];
        return { platform: 'douyin', url: profileUrl, ok: true, excerpt: clip(parts.join('\n')), method: 'douyin-web-api' };
      }
    }
  } catch { /* fall through */ }

  // 回退：Playwright 截图
  const shot = await screenshotPlatformPage('douyin', secUid);
  if (shot.ok && shot.dataUrl) {
    return { platform: 'douyin', url: profileUrl, ok: true, excerpt: '[截图已获取，交由视觉模型分析]', method: 'playwright-screenshot', screenshotDataUrl: shot.dataUrl };
  }
  return { platform: 'douyin', url: profileUrl, ok: false, excerpt: '抖音数据获取失败', method: 'none' };
}

export async function scrapeNetease(uid: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('netease');
  try {
    const res = await fetchWithTimeout(
      `https://music.163.com/api/v1/user/detail/${encodeURIComponent(uid)}`,
      { headers: { 'User-Agent': UA, Referer: 'https://music.163.com/', Cookie: cookie } },
    );
    if (res.ok) {
      const data = (await res.json()) as any;
      const p = data?.profile;
      if (p?.nickname) {
        const parts: string[] = [
          `昵称：${p.nickname}`,
          p.signature && `签名：${p.signature}`,
          p.gender != null && `性别：${p.gender === 1 ? '男' : p.gender === 2 ? '女' : '未知'}`,
          p.province && `省份代码：${p.province}`,
          p.follows != null && `关注数：${p.follows}`,
          p.followeds != null && `粉丝数：${p.followeds}`,
          data.listenSongs != null && `听歌数：${data.listenSongs}`,
          data.level != null && `等级：${data.level}`,
        ].filter(Boolean) as string[];
        return { platform: 'netease', url: profileUrl, ok: true, excerpt: clip(parts.join('\n')), method: 'netease-api-v1' };
      }
    }
  } catch { /* fall through */ }
  // 回退：HTML 直连
  const { text, method } = await directThenReader(`https://music.163.com/user/home?id=${encodeURIComponent(uid)}`, cookie);
  return { platform: 'netease', url: profileUrl, ok: text.length >= 40, excerpt: text, method };
}

type UploadRow = { type: string; content: string | null };

function parsePlatformPayload(content: string): { url: string; extractedId: string } | null {
  try {
    const j = JSON.parse(content) as { profileUrl?: string; extractedId?: string };
    if (j.profileUrl && typeof j.profileUrl === 'string')
      return { url: j.profileUrl, extractedId: String(j.extractedId || '') };
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 每个绑定平台都尽量附带 Playwright 截图（供多模态模型）。
 * 先完成文字/API 抓取，再截图，避免与 fetch 抢资源；失败则等待后重试一次。
 */
async function attachPlatformScreenshot(
  result: ScrapeOutcome,
  platform: PlatformKey,
  extractedId: string,
): Promise<ScrapeOutcome> {
  let shot = await screenshotPlatformPage(platform, extractedId);
  if (!shot.ok || !shot.dataUrl) {
    await new Promise((r) => setTimeout(r, 1500));
    shot = await screenshotPlatformPage(platform, extractedId);
  }
  if (shot.ok && shot.dataUrl) {
    result.screenshotDataUrl = shot.dataUrl;
  }
  return result;
}

/** 文字抓取完成后附截图（顺序执行 + 重试，保证各平台尽量有图） */
async function withScreenshot(outcome: Promise<ScrapeOutcome>, platform: PlatformKey, extractedId: string): Promise<ScrapeOutcome> {
  const result = await outcome;
  return attachPlatformScreenshot(result, platform, extractedId);
}

export async function scrapeFromPlatformUploads(uploads: UploadRow[]): Promise<ScrapeOutcome[]> {
  const jobs: Promise<ScrapeOutcome>[] = [];

  for (const row of uploads) {
    if (!row.content || !row.type.startsWith('platform:')) continue;
    const platform = row.type.slice('platform:'.length) as PlatformKey;
    const payload = parsePlatformPayload(row.content);
    if (!payload) continue;

    const { url, extractedId } = payload;

    switch (platform) {
      case 'weibo':
        jobs.push(withScreenshot(scrapeWeibo(extractedId || url.replace(/.*\/u\//, '').replace(/\D.*$/, '') || '', url), 'weibo', extractedId));
        break;
      case 'douban':
        jobs.push(withScreenshot(scrapeDouban(extractedId, url), 'douban', extractedId));
        break;
      case 'xhs':
        jobs.push(scrapeXhs(extractedId, url)); // XHS 已内置截图
        break;
      case 'douyin':
        jobs.push(withScreenshot(scrapeDouyin(extractedId, url), 'douyin', extractedId));
        break;
      case 'netease':
        jobs.push(withScreenshot(scrapeNetease(extractedId, url), 'netease', extractedId));
        break;
      default:
        break;
    }
  }

  return Promise.all(jobs);
}
