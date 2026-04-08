import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function fetchWithTimeout(url, init = {}, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(t);
  }
}

async function scrapeHtml(url, referer) {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(referer ? { Referer: referer } : {}),
      },
    });
    const $ = cheerio.load(await res.text());
    const title = $('title').first().text().trim();
    const desc =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';
    $('script,noscript,style').remove();
    const body = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 400);
    const text = [title, desc, body].filter(Boolean).join(' | ');
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: '', err: e.message };
  }
}

async function scrapeJina(targetUrl) {
  const jinaUrl = `https://r.jina.ai/${targetUrl}`;
  try {
    const res = await fetchWithTimeout(
      jinaUrl,
      { headers: { 'User-Agent': UA, Accept: 'text/plain,*/*', 'X-Return-Format': 'markdown' } },
      25000,
    );
    const text = (await res.text()).slice(0, 500);
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: '', err: e.message };
  }
}

async function scrapeWeiboApi(uid) {
  const api = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`;
  try {
    const res = await fetchWithTimeout(api, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://m.weibo.cn/',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (res.ok) {
      const data = await res.json();
      const u = data?.data?.userInfo;
      if (u?.screen_name) {
        const text = [
          `昵称：${u.screen_name}`,
          u.description && `简介：${u.description}`,
          u.verified_reason && `认证：${u.verified_reason}`,
          `微博数：${u.statuses_count ?? '?'}`,
        ].filter(Boolean).join('\n');
        return { status: res.status, text, method: 'weibo-api' };
      }
    }
    return { status: res.status, text: '', method: 'weibo-api-empty' };
  } catch (e) {
    return { status: 0, text: '', err: e.message };
  }
}

async function scrapeNeteaseApi(uid) {
  const api = `https://music.163.com/api/user/detail?id=${uid}`;
  try {
    const res = await fetchWithTimeout(api, {
      headers: { 'User-Agent': UA, Referer: 'https://music.163.com/' },
    });
    if (res.ok) {
      const data = await res.json();
      const p = data?.profile;
      if (p?.nickname) {
        const text = [
          `昵称：${p.nickname}`,
          p.signature && `签名：${p.signature}`,
          `关注：${p.follows ?? 0}  粉丝：${p.followeds ?? 0}`,
          `听歌数：${p.listenSongs ?? 0}`,
        ].filter(Boolean).join('\n');
        return { status: res.status, text, method: 'netease-api' };
      }
    }
    return { status: res.status, text: '', method: 'netease-api-empty' };
  } catch (e) {
    return { status: 0, text: '', err: e.message };
  }
}

// 网易云 API 原始响应调试
async function debugNeteaseApi(uid) {
  const api = `https://music.163.com/api/user/detail?id=${uid}`;
  try {
    const res = await fetchWithTimeout(api, {
      headers: { 'User-Agent': UA, Referer: 'https://music.163.com/' },
    });
    const raw = await res.text();
    return { status: res.status, text: raw.slice(0, 300) };
  } catch (e) {
    return { status: 0, text: '', err: e.message };
  }
}

const TESTS = [
  // 微博
  { name: '微博 (API)', fn: () => scrapeWeiboApi('7487955617') },
  { name: '微博 (Jina)', fn: () => scrapeJina('https://weibo.com/u/7487955617') },
  // 豆瓣（用户真实 ID 225574042）
  { name: '豆瓣 (HTML)', fn: () => scrapeHtml('https://www.douban.com/people/225574042/') },
  { name: '豆瓣 (Jina)', fn: () => scrapeJina('https://www.douban.com/people/225574042/') },
  // 网易云
  { name: '网易云 API (raw)', fn: () => debugNeteaseApi('530688535') },
  { name: '网易云 (Jina)', fn: () => scrapeJina('https://music.163.com/user/home?id=530688535') },
  // 小红书
  { name: '小红书 (HTML keyword)', fn: () => scrapeHtml('https://www.xiaohongshu.com/search_result?keyword=416227302&source=web_explore_feed') },
  { name: '小红书 user/profile (Jina)', fn: () => scrapeJina('https://www.xiaohongshu.com/user/profile/416227302') },
  // 抖音（/user/self 是登录态跳转，测公开 profile 格式）
  { name: '抖音 (Jina /user/self)', fn: () => scrapeJina('https://www.douyin.com/user/self') },
];

for (const t of TESTS) {
  process.stdout.write(`\n【${t.name}】 ...`);
  const r = await t.fn();
  const preview = (r.text || '(空)').replace(/\n/g, ' ').slice(0, 200);
  console.log(` status=${r.status} len=${r.text?.length ?? 0}${r.err ? ' err=' + r.err : ''}`);
  console.log(`  摘录: ${preview}`);
}
