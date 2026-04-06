import * as cheerio from 'cheerio';
import type { PlatformKey } from '@/lib/platformUrls';
import { getCookieHeader } from '@/lib/loadCookies';
import { screenshotMultiplePlatforms, type ScreenshotTask } from '@/lib/screenshotPlatformBatch';
import { xhsOpenEntryUrlAndProfileExcerpt } from '@/lib/xhsSearchProfile';
import { resolveXhsShareLinkToProfileUrl } from '@/lib/xhsResolveShareLink';
import { isXhsShareLink } from '@/lib/platformUrls';
import path from 'path';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

export type ScrapeOutcome = {
  platform: PlatformKey;
  url: string;
  ok: boolean;
  excerpt: string;
  method?: string;
  screenshotDataUrl?: string; // base64 PNG，用于 GPT-4o 视觉分析
  /** 截图阶段应用的实际用户 ID（可能与建档录入的不同，如 xhs 搜索后的真实 profile id） */
  screenshotId?: string;
};

const PUBLIC_LABEL: Record<PlatformKey, string> = {
  weibo: '微博',
  xhs: '小红书',
  douyin: '抖音',
  netease: '网易云音乐',
  douban: '豆瓣',
  zhihu: '知乎',
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

/** 截图兜底时写入报告的正文（用户可读，非内部占位符） */
export const EXCERPT_SCREENSHOT_FALLBACK =
  '已获取该主页截图，原站未返回可解析文字摘要；人设与动态请以模型对截图的综合解读为准。';

function logScrape(platform: string, message: string, extra?: Record<string, unknown>) {
  const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[Scrape][${platform}] ${message}${tail}`);
}

/** 供 /api/analyze 等打一行摘要 */
export function summarizeScrapesForLog(scrapes: ScrapeOutcome[]): string {
  return scrapes
    .map(
      (o) =>
        `${o.platform}:${o.ok ? 'ok' : 'fail'}/${o.method ?? '-'}/excerpt=${(o.excerpt || '').length}`,
    )
    .join(' | ');
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
    if (!infoRes.ok) {
      logScrape('weibo', 'ajax profile/info 失败', { status: infoRes.status, uid: String(uid).slice(0, 12) });
    }
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

  // 尝试 API 方式获取用户信息
  try {
    const apiUrl = `https://m.douban.com/rexxar/api/v2/user/${encodeURIComponent(peopleId)}`;
    const res = await fetchWithTimeout(apiUrl, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.douban.com/',
        Cookie: cookie,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      logScrape('douban', 'rexxar user API 失败', { status: res.status, peopleId: String(peopleId).slice(0, 16) });
    }
    if (res.ok) {
      const data = (await res.json()) as any;
      if (data?.name) {
        const parts: string[] = [
          `昵称：${data.name}`,
          data.intro && `简介：${data.intro}`,
          data.loc && data.loc.name && `地区：${data.loc.name}`,
          data.reg_time && `注册时间：${data.reg_time}`,
        ].filter(Boolean) as string[];

        // 尝试获取用户的书影音数据
        try {
          const statusUrl = `https://m.douban.com/rexxar/api/v2/user/${encodeURIComponent(peopleId)}/interests?type=collect&count=5`;
          const statusRes = await fetchWithTimeout(statusUrl, {
            headers: {
              'User-Agent': UA,
              Referer: profileUrl,
              Cookie: cookie,
              Accept: 'application/json',
            },
          });
          if (statusRes.ok) {
            const statusData = (await statusRes.json()) as any;
            const interests = statusData?.interests || [];
            if (interests.length > 0) {
              const items = interests.slice(0, 3).map((item: any) => {
                const subject = item?.subject;
                return subject?.title ? `${subject.title}（${subject.type || ''}）` : '';
              }).filter(Boolean);
              if (items.length) {
                parts.push(`\n最近收藏：\n${items.join('\n')}`);
              }
            }
          }
        } catch { /* ignore */ }

        return {
          platform: 'douban',
          url: profileUrl,
          ok: true,
          excerpt: clip(parts.join('\n')),
          method: 'douban-api'
        };
      }
    }
  } catch { /* fall through */ }

  // API 失败，回退到 HTML 抓取
  const { text, method } = await directThenReader(profileUrl, cookie);
  return {
    platform: 'douban',
    url: profileUrl,
    ok: text.length >= 40,
    excerpt: text,
    method,
  };
}

export async function scrapeXhs(_keyword: string, profileUrl: string): Promise<ScrapeOutcome> {
  if (!isXhsShareLink(profileUrl)) {
    logScrape('xhs', '非 xhslink.com 短链，跳过（需用 App 分享链接）', { profileUrl: profileUrl.slice(0, 80) });
    return { platform: 'xhs', url: profileUrl, ok: false, excerpt: '', method: 'invalid-xhs-url' };
  }

  try {
    // 1. HTTP 解析短链 → 带 xsec_token 的完整主页 URL
    const resolvedProfilePageUrl = await resolveXhsShareLinkToProfileUrl(profileUrl);
    const entryForBrowser = resolvedProfilePageUrl || profileUrl;
    logScrape('xhs', '短链已解析', { resolved: (resolvedProfilePageUrl ?? '未解析到').slice(0, 100) });

    // 2. 用 Playwright 打开主页，获取正文 + 截图（一次浏览器会话完成两件事）
    const direct = await xhsOpenEntryUrlAndProfileExcerpt({
      entryUrl: entryForBrowser,
      headless: true,
      captureScreenshot: true,   // 新增：同时截图
    });

    if (direct.ok && direct.profileExcerpt) {
      logScrape('xhs', '抓取成功', { excerptLen: direct.profileExcerpt.length, hasScreenshot: !!direct.screenshotDataUrl });
      return {
        platform: 'xhs',
        url: direct.profileUrl || profileUrl,
        ok: true,
        excerpt: clip(direct.profileExcerpt),
        method: 'xhs-share-link',
        screenshotDataUrl: direct.screenshotDataUrl,  // scrape 阶段已截图，batch 阶段会跳过
        screenshotId: '__done__',                     // 告知 batch 无需重复截图
      };
    }
    logScrape('xhs', '分享链直达未拿到足够正文', { err: direct.error });
  } catch (error) {
    console.error('[XHS] 分享链接直达失败:', error);
  }

  return { platform: 'xhs', url: profileUrl, ok: false, excerpt: '', method: 'xhs-share-failed' };
}

export async function scrapeDouyin(secUid: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('douyin');
  const hasCookie = cookie.length > 20;
  if (!hasCookie) {
    logScrape('douyin', 'Cookie 过短或缺失', { cookieLen: cookie.length });
  }

  const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
  const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  /** 尝试从任意抖音 API 端点解析出用户信息，成功则返回 parts 数组 */
  async function tryEndpoint(url: string, ua: string): Promise<string[] | null> {
    try {
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': ua, Referer: 'https://www.douyin.com/', Cookie: cookie, Accept: 'application/json' },
      });
      const text = await res.text();
      if (!res.ok) return null;
      let data: any;
      try { data = JSON.parse(text); } catch { return null; }
      const u = data?.user ?? data?.data?.user ?? data?.user_info;
      if (!u?.nickname) return null;
      return [
        `昵称：${u.nickname}`,
        u.signature && `简介：${u.signature}`,
        u.city && `城市：${u.city}`,
        u.follower_count != null && `粉丝数：${u.follower_count}`,
        u.following_count != null && `关注数：${u.following_count}`,
        u.aweme_count != null && `作品数：${u.aweme_count}`,
        u.total_favorited != null && `获赞数：${u.total_favorited}`,
      ].filter(Boolean) as string[];
    } catch {
      return null;
    }
  }

  if (secUid && secUid !== 'self') {
    const endpoints = [
      // 端点1：官方 web API（有时不需要签名）
      [`https://www.douyin.com/aweme/v1/web/user/profile/other/?sec_user_id=${encodeURIComponent(secUid)}&aid=6383&cookie_enabled=1&msToken=`, UA_PC],
      // 端点2：iesdouyin 旧版
      [`https://www.iesdouyin.com/web/api/v2/user/info/?sec_uid=${encodeURIComponent(secUid)}`, UA_MOBILE],
      // 端点3：不同 aid
      [`https://www.douyin.com/aweme/v1/web/user/profile/other/?sec_user_id=${encodeURIComponent(secUid)}&aid=1128&cookie_enabled=1`, UA_PC],
    ] as [string, string][];

    for (const [url, ua] of endpoints) {
      const parts = await tryEndpoint(url, ua);
      if (parts) {
        logScrape('douyin', 'API 成功', { endpoint: url.slice(0, 60) });
        return { platform: 'douyin', url: profileUrl, ok: true, excerpt: clip(parts.join('\n')), method: 'douyin-web-api' };
      }
    }
    logScrape('douyin', '所有 API 端点均失败，抖音网页需要签名参数，无法无头自动获取', { secUid: secUid.slice(0, 16) });
  }

  // 不再回退 Playwright 截图（抖音无头模式必触发验证码）
  // 返回明确失败，并给报告一条可用的说明文字
  return {
    platform: 'douyin',
    url: profileUrl,
    ok: false,
    excerpt: '抖音主页需要签名验证或人机校验，服务端无法自动抓取。建议在"说说你自己"环节多写几句抖音内容描述，帮助档案更准确。',
    method: 'no-api-access',
  };
}

export async function scrapeNetease(uid: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('netease');
  try {
    const res = await fetchWithTimeout(
      `https://music.163.com/api/v1/user/detail/${encodeURIComponent(uid)}`,
      { headers: { 'User-Agent': UA, Referer: 'https://music.163.com/', Cookie: cookie } },
    );
    if (!res.ok) {
      logScrape('netease', 'user/detail API 失败', { status: res.status, uid: String(uid).slice(0, 12) });
    }
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

export async function scrapeZhihu(urlToken: string, profileUrl: string): Promise<ScrapeOutcome> {
  const cookie = getCookieHeader('zhihu');
  if (cookie.length < 20) {
    logScrape('zhihu', 'Cookie 过短或缺失，API 可能失败', { cookieLen: cookie.length });
  }

  try {
    const apiUrl = `https://www.zhihu.com/api/v4/members/${encodeURIComponent(urlToken)}?include=headline,answer_count,articles_count,follower_count,voteup_count,thanked_count,favorited_count`;
    const res = await fetchWithTimeout(apiUrl, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.zhihu.com/',
        Cookie: cookie,
        Accept: 'application/json',
        'x-requested-with': 'fetch',
      },
    });

    if (!res.ok) {
      const snippet = await res.text().then((t) => t.slice(0, 260)).catch(() => '');
      logScrape('zhihu', 'members API HTTP 失败', { status: res.status, snippet });
    } else {
      const data = (await res.json()) as any;
      if (data?.error) {
        logScrape('zhihu', 'members API JSON 含 error', { message: data.error?.message, code: data.error?.code });
      } else if (data?.name) {
        const parts: string[] = [
          `昵称：${data.name}`,
          data.headline && `一句话介绍：${data.headline}`,
          data.description && `个人简介：${data.description}`,
          data.answer_count != null && `回答数：${data.answer_count}`,
          data.articles_count != null && `文章数：${data.articles_count}`,
          data.follower_count != null && `关注者：${data.follower_count}`,
          data.voteup_count != null && `获赞数：${data.voteup_count}`,
        ].filter(Boolean) as string[];

        try {
          const activitiesUrl = `https://www.zhihu.com/api/v4/members/${encodeURIComponent(urlToken)}/activities?limit=5&after_id=0`;
          const actRes = await fetchWithTimeout(activitiesUrl, {
            headers: {
              'User-Agent': UA,
              Referer: profileUrl,
              Cookie: cookie,
              Accept: 'application/json',
            },
          });
          if (!actRes.ok) {
            logScrape('zhihu', 'activities API 失败', { status: actRes.status });
          } else if (actRes.ok) {
            const actData = (await actRes.json()) as any;
            const activities = actData?.data || [];
            if (activities.length > 0) {
              const items = activities.slice(0, 3).map((act: any) => {
                const target = act?.target;
                if (target?.question?.title) {
                  return `回答了：${target.question.title}`;
                } else if (target?.title) {
                  return `发表了：${target.title}`;
                }
                return '';
              }).filter(Boolean);
              if (items.length) {
                parts.push(`\n最近动态：\n${items.join('\n')}`);
              }
            }
          }
        } catch (e) {
          logScrape('zhihu', 'activities 请求异常', { err: e instanceof Error ? e.message : String(e) });
        }

        logScrape('zhihu', 'members API 成功', { method: 'zhihu-api' });
        return {
          platform: 'zhihu',
          url: profileUrl,
          ok: true,
          excerpt: clip(parts.join('\n')),
          method: 'zhihu-api',
        };
      } else {
        logScrape('zhihu', 'members API 200 但缺少 name', { keys: Object.keys(data || {}).slice(0, 12) });
      }
    }
  } catch (e) {
    logScrape('zhihu', 'members API 异常', { err: e instanceof Error ? e.message : String(e) });
  }

  const { text, method } = await directThenReader(profileUrl, cookie);
  const ok = text.length >= 40;
  logScrape('zhihu', 'HTML/Reader 回退', { method, textLen: text.length, ok });
  return {
    platform: 'zhihu',
    url: profileUrl,
    ok,
    excerpt: text,
    method,
  };
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

// 智能截图策略：只对视觉依赖强的平台截图
const SCREENSHOT_PRIORITY: Record<PlatformKey, 'required' | 'optional' | 'skip'> = {
  xhs: 'required',      // 小红书视觉为主，必须截图
  douyin: 'skip',       // 抖音无头模式必触发验证码，截图无意义，直接跳过
  weibo: 'required',    // 微博 - 截图
  douban: 'required',   // 豆瓣 - 截图
  netease: 'required',  // 网易云 - 截图
  zhihu: 'required',    // 知乎 - 截图
};

function shouldScreenshot(platform: PlatformKey, hasApiData: boolean): boolean {
  const priority = SCREENSHOT_PRIORITY[platform];
  if (priority === 'required') return true;
  if (priority === 'skip') return false;
  // optional: 只在 API 数据不足时截图
  return !hasApiData;
}

export async function scrapeFromPlatformUploads(uploads: UploadRow[]): Promise<ScrapeOutcome[]> {
  const results: ScrapeOutcome[] = [];
  const screenshotTasks: ScreenshotTask[] = [];
  const latestPlatformPayloads = new Map<PlatformKey, { url: string; extractedId: string }>();

  for (const row of uploads) {
    if (!row.content || !row.type.startsWith('platform:')) continue;
    const platform = row.type.slice('platform:'.length) as PlatformKey;
    const payload = parsePlatformPayload(row.content);
    if (!payload) continue;
    // 相同平台只保留最后一次绑定，避免重复抓取/截图拖慢并放大资源占用
    latestPlatformPayloads.set(platform, payload);
  }

  // 阶段 1：串行执行所有 API 抓取（不启动浏览器）
  console.log('[Scrape] 开始 API 抓取阶段...');
  for (const [platform, payload] of latestPlatformPayloads.entries()) {
    const { url, extractedId } = payload;

    let result: ScrapeOutcome | null = null;

    switch (platform) {
      case 'weibo':
        result = await scrapeWeibo(extractedId || url.replace(/.*\/u\//, '').replace(/\D.*$/, '') || '', url);
        break;
      case 'douban':
        result = await scrapeDouban(extractedId, url);
        break;
      case 'xhs':
        result = await scrapeXhs(extractedId, url);
        break;
      case 'douyin':
        result = await scrapeDouyin(extractedId, url);
        break;
      case 'netease':
        result = await scrapeNetease(extractedId, url);
        break;
      case 'zhihu':
        result = await scrapeZhihu(extractedId, url);
        break;
      default:
        continue;
    }

    if (result) {
      results.push(result);

      // XHS 在 scrape 阶段已截图（screenshotId === '__done__'），不再加入 batch
      const xhsDone = platform === 'xhs' && result.screenshotId === '__done__';
      const hasApiData = result.ok && result.excerpt.length > 100;
      const willScreenshot = !xhsDone && shouldScreenshot(platform, hasApiData);
      const shotId = result.screenshotId && result.screenshotId !== '__done__'
        ? result.screenshotId
        : extractedId;

      logScrape(platform, 'API 阶段结束', {
        ok: result.ok,
        method: result.method,
        excerptLen: result.excerpt.length,
        willScreenshot,
        xhsDone,
      });
      if (willScreenshot) {
        screenshotTasks.push({ platform, extractedId: shotId });
      }
    }
  }

  // 阶段 2：批量截图（复用浏览器实例，串行执行）
  if (screenshotTasks.length > 0) {
    console.log(`[Scrape] 开始截图阶段，共 ${screenshotTasks.length} 个任务...`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const screenshotDir = path.join(process.cwd(), 'public', 'debug-screenshots', `analysis_${timestamp}`);

    let screenshots: Map<PlatformKey, import('@/lib/screenshotPlatformBatch').ScreenshotResult>;
    try {
      screenshots = await screenshotMultiplePlatforms(screenshotTasks, screenshotDir);
    } catch (e: any) {
      console.error('[Scrape] 截图阶段整体异常，跳过截图:', e?.message ?? e);
      screenshots = new Map();
    }

    // 将截图结果合并回去
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const shot = screenshots.get(result.platform);

      if (shot?.ok && shot.dataUrl) {
        result.screenshotDataUrl = shot.dataUrl;

        if (!result.ok || result.method === 'pending-screenshot') {
          const wasPending = result.method === 'pending-screenshot';
          result.ok = true;
          result.excerpt = EXCERPT_SCREENSHOT_FALLBACK;
          result.method = 'playwright-screenshot';
          logScrape(result.platform, '截图成功，已用截图兜底正文', { wasPending });
        }
      } else if (result.method === 'pending-screenshot') {
        result.ok = false;
        const label = PUBLIC_LABEL[result.platform] || result.platform;
        result.excerpt = `${label}：截图失败或 Cookie 无效，无法展示主页（${shot?.error ?? '无截图数据'}）`;
        result.method = 'none';
        logScrape(result.platform, '截图阶段失败（此前 API/HTML 也未拿到正文）', {
          error: shot?.error ?? 'no result',
        });
      }
    }
  }

  console.log(`[Scrape] 完成，共 ${results.length} 个平台，${screenshotTasks.length} 个截图任务 | ${summarizeScrapesForLog(results)}`);
  return results;
}
