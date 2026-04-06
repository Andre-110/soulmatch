/** Parse pasted profile URLs or raw IDs into canonical profile URLs (aligned with user-provided examples). */

export type PlatformKey = 'weibo' | 'xhs' | 'douyin' | 'netease' | 'douban' | 'zhihu';

const CANON = {
  weibo: (id: string) => `https://weibo.com/u/${id}`,
  xhs: (id: string) =>
    `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(id)}&source=web_explore_feed`,
  douyin: (id: string) => `https://www.douyin.com/user/${id}`,
  netease: (id: string) => `https://music.163.com/#/user/home?id=${id}`,
  douban: (id: string) => `https://www.douban.com/people/${id}/`,
  zhihu: (id: string) => `https://www.zhihu.com/people/${id}`,
} as const;

function extractDigitsSegment(s: string): string | null {
  const m = s.match(/^\d+$/);
  return m ? m[0] : null;
}

/** Douban people id: numeric or mixed (e.g. alphanumeric username). */
function extractDoubanPeople(pathOrFull: string): string | null {
  const m = pathOrFull.match(/\/people\/([^/?#]+)\/?/);
  if (m) return decodeURIComponent(m[1]);
  const t = pathOrFull.trim().replace(/^\/+|\/+$/g, '');
  if (t.length > 0) return t;
  return null;
}

export function resolvePlatformUrl(
  platform: PlatformKey,
  input: string
): { ok: true; url: string; extractedId: string } | { ok: false; error: string } {
  let raw = input.trim();
  if (!raw) return { ok: false, error: '请粘贴主页链接或填写用户 ID' };

  if (!/^https?:\/\//i.test(raw) && /\.[a-z]{2,}/i.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, '')}`;
  }

  const lower = raw.toLowerCase();

  try {
    if (lower.includes('weibo.com')) {
      const m = raw.match(/weibo\.com\/u\/(\d+)/i);
      const id = m?.[1];
      if (!id) return { ok: false, error: '无法从微博链接中解析用户 ID（预期 …/u/数字）' };
      const url = CANON.weibo(id);
      return { ok: true, url, extractedId: id };
    }

    if (lower.includes('xiaohongshu.com')) {
      let id: string | null = null;
      try {
        const u = new URL(raw);
        id = u.searchParams.get('keyword');
      } catch {
        const m = raw.match(/keyword=([^&]+)/i);
        id = m ? decodeURIComponent(m[1]) : null;
      }
      if (!id || !id.trim()) return { ok: false, error: '无法从小红书链接中解析 keyword' };
      const trimmed = id.trim();
      const url = CANON.xhs(trimmed);
      return { ok: true, url, extractedId: trimmed };
    }

    if (lower.includes('douyin.com')) {
      const m = raw.match(/douyin\.com\/user\/([^/?#]+)/i);
      const id = m?.[1];
      if (!id) return { ok: false, error: '无法从抖音链接中解析用户段（预期 …/user/…）' };
      const url = CANON.douyin(id);
      return { ok: true, url, extractedId: id };
    }

    if (lower.includes('douban.com')) {
      const id = extractDoubanPeople(raw);
      if (!id) return { ok: false, error: '无法从豆瓣链接中解析 people 段' };
      const url = CANON.douban(id);
      return { ok: true, url, extractedId: id };
    }

    if (lower.includes('music.163.com')) {
      const m = raw.match(/[?&#]id=(\d+)/);
      const id = m?.[1];
      if (!id) return { ok: false, error: '无法从网易云链接中解析用户 id=数字（可含 #/user/home）' };
      const url = CANON.netease(id);
      return { ok: true, url, extractedId: id };
    }

    if (lower.includes('zhihu.com')) {
      const m = raw.match(/zhihu\.com\/people\/([^/?#]+)/i);
      const id = m?.[1];
      if (!id) return { ok: false, error: '无法从知乎链接中解析用户名（预期 …/people/…）' };
      const url = CANON.zhihu(id);
      return { ok: true, url, extractedId: id };
    }
  } catch {
    /* fall through to raw-id */
  }

  // Plain ID / keyword per platform
  if (platform === 'weibo') {
    const id = extractDigitsSegment(raw);
    if (!id) return { ok: false, error: '微博用户 ID 应为数字' };
    return { ok: true, url: CANON.weibo(id), extractedId: id };
  }
  if (platform === 'xhs') {
    return { ok: true, url: CANON.xhs(raw), extractedId: raw };
  }
  if (platform === 'douyin') {
    if (!raw.length) return { ok: false, error: '抖音用户 ID 不能为空' };
    return { ok: true, url: CANON.douyin(raw), extractedId: raw };
  }
  if (platform === 'netease') {
    const id = extractDigitsSegment(raw);
    if (!id) return { ok: false, error: '网易云用户 id 应为数字' };
    return { ok: true, url: CANON.netease(id), extractedId: id };
  }
  if (platform === 'douban') {
    const id = extractDoubanPeople(raw) ?? raw.replace(/^\/+|\/+$/g, '');
    if (!id) return { ok: false, error: '豆瓣 people 标识无效' };
    return { ok: true, url: CANON.douban(id), extractedId: id };
  }
  if (platform === 'zhihu') {
    const id = raw.replace(/^\/+|\/+$/g, '');
    if (!id) return { ok: false, error: '知乎用户名不能为空' };
    return { ok: true, url: CANON.zhihu(id), extractedId: id };
  }

  return { ok: false, error: '未知平台' };
}

/**
 * Playwright 截图用 URL：与建档 canonical 对齐。
 * 小红书：24 位 hex 走个人主页，否则与建档一致走搜索页（keyword 不是 profile id）。
 * 网易云：使用无 hash 直链，避免 SPA 在自动化里落到 404。
 */
export function screenshotTargetUrl(platform: PlatformKey, extractedId: string): string {
  switch (platform) {
    case 'weibo':
      return `https://weibo.com/u/${extractedId}`;
    case 'xhs':
      if (/^[a-f0-9]{24}$/i.test(extractedId)) {
        return `https://www.xiaohongshu.com/user/profile/${extractedId}`;
      }
      return CANON.xhs(extractedId);
    case 'douyin':
      return extractedId && extractedId !== 'self'
        ? `https://www.douyin.com/user/${extractedId}`
        : `https://www.douyin.com/user/self`;
    case 'netease':
      return `https://music.163.com/#/user/home?id=${encodeURIComponent(extractedId)}`;
    case 'douban':
      return `https://www.douban.com/people/${extractedId}/`;
    case 'zhihu':
      return `https://www.zhihu.com/people/${extractedId}`;
    default:
      return '';
  }
}
