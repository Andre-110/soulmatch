import * as cheerio from 'cheerio';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Referer: 'https://www.google.com/',
};

/** 从 HTML 文本中提取可读正文（去掉脚本、样式、注释） */
function extractText(html: string, maxLen = 4000): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, img, svg, head').remove();
  const text = $.root().text().replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLen);
}

/** 网易云：SPA hash 路由无法直接爬，改用其公开 API */
async function fetchNetease(id: string): Promise<string> {
  const apiUrl = `https://music.163.com/api/user/detail?id=${id}`;
  const res = await fetch(apiUrl, {
    headers: { ...BROWSER_HEADERS, Referer: 'https://music.163.com/' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return `[网易云 API 响应 ${res.status}]`;
  const json = await res.json();
  const p = json?.profile;
  if (!p) return '[网易云 API 未返回 profile 字段]';
  return [
    `昵称：${p.nickname ?? ''}`,
    `签名：${p.signature ?? ''}`,
    `关注数：${p.follows ?? 0}，粉丝数：${p.followeds ?? 0}`,
    `听歌数：${p.listenSongs ?? 0}`,
    `VIP：${p.vipType ? '是' : '否'}`,
  ].join('\n');
}

export interface PlatformFetchResult {
  platform: string;
  url: string;
  content: string;
  ok: boolean;
}

/**
 * 服务端抓取平台主页，返回可读文本。
 * @param platform  平台 key（weibo / xhs / douyin / netease / douban）
 * @param url       已解析的 canonical URL
 */
export async function fetchPlatformPage(
  platform: string,
  url: string,
): Promise<PlatformFetchResult> {
  try {
    // 网易云特殊处理（hash SPA）
    if (platform === 'netease') {
      const idMatch = url.match(/id=(\d+)/);
      if (!idMatch) return { platform, url, ok: false, content: '[无法解析网易云 ID]' };
      const content = await fetchNetease(idMatch[1]);
      return { platform, url, ok: true, content };
    }

    // 通用 fetch
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    if (!res.ok) {
      return { platform, url, ok: false, content: `[HTTP ${res.status}，可能需要登录或被反爬]` };
    }

    const html = await res.text();
    const content = extractText(html);
    if (!content) return { platform, url, ok: false, content: '[页面内容为空，可能需要登录]' };
    return { platform, url, ok: true, content };
  } catch (e: any) {
    return { platform, url, ok: false, content: `[抓取失败: ${e?.message ?? String(e)}]` };
  }
}
