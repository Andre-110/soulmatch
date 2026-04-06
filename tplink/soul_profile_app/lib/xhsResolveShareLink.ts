/**
 * 小红书短链 xhslink.com/m/… 的响应体里带有 <a href="https://www.xiaohongshu.com/user/profile/24hex?xsec_token=…">，
 * 用 HTTP 解析即可得到带 token 的主页 URL（与 curl 行为一致），再交给 Playwright 打开/截图。
 */

const FETCH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * 将分享短链解析为完整个人主页 URL（含 query，如 xsec_token）。
 * 非短链或解析失败时返回 null。
 */
export async function resolveXhsShareLinkToProfileUrl(shareUrl: string): Promise<string | null> {
  const trimmed = shareUrl.trim();
  if (!/^https?:\/\//i.test(trimmed) && /\.[a-z]{2,}/i.test(trimmed)) {
    return resolveXhsShareLinkToProfileUrl(`https://${trimmed.replace(/^\/+/, '')}`);
  }
  if (!/xhslink\.com\/m\//i.test(trimmed)) return null;

  try {
    // 勿自动跟随重定向：跟随后会落到 SPA，拿不到短链页里的 href；短链多为 302 + HTML 内带 <a href="…profile…?xsec_token=…">
    const res = await fetch(trimmed, {
      redirect: 'manual',
      headers: {
        'User-Agent': FETCH_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    const loc = res.headers.get('location');
    if (loc && /xiaohongshu\.com\/user\/profile\//i.test(loc)) {
      return new URL(loc, trimmed).href;
    }

    const html = await res.text();
    const m =
      html.match(/href="(https:\/\/www\.xiaohongshu\.com\/user\/profile\/[a-f0-9]{24}[^"]*)"/i) ||
      html.match(/href='(https:\/\/www\.xiaohongshu\.com\/user\/profile\/[a-f0-9]{24}[^']*)'/i);
    if (!m) return null;
    return decodeHtmlEntities(m[1]);
  } catch {
    return null;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}
