// 用真实 cookie 测试各平台抓取
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const COOKIES_DIR = path.join(process.cwd(), '..', 'cookies');
const COOKIE_FILES = {
  xhs:     'cookies (6).json',
  weibo:   'cookies (7).json',
  douyin:  'cookies (8).json',
  netease: 'cookies (9).json',
  douban:  'cookies (10).json',
};

function getCookieHeader(platform) {
  try {
    const file = path.join(COOKIES_DIR, COOKIE_FILES[platform]);
    const arr = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return arr.filter(c => c.name && c.value).map(c => `${c.name}=${c.value}`).join('; ');
  } catch { return ''; }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

async function fetchPage(url, cookie, referer) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(referer ? { Referer: referer } : {}),
      },
    });
    clearTimeout(t);
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('title').first().text().trim();
    const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
    $('script,noscript,style').remove();
    const body = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 500);
    return { status: res.status, text: [title, desc, body].filter(Boolean).join(' | ').slice(0, 600) };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, text: '', err: e.message };
  }
}

async function fetchWeiboApi(uid, cookie) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 12000);
  const res = await fetch(`https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}`, {
    signal: ctrl.signal,
    headers: { 'User-Agent': UA, Referer: 'https://m.weibo.cn/', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: cookie },
  });
  const data = await res.json();
  const u = data?.data?.userInfo;
  if (u?.screen_name) {
    return { status: res.status, text: `昵称：${u.screen_name}\n简介：${u.description || ''}\n认证：${u.verified_reason || ''}\n微博数：${u.statuses_count ?? '?'}` };
  }
  return { status: res.status, text: JSON.stringify(data).slice(0, 200) };
}

async function fetchNeteaseApi(uid, cookie) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 12000);
  // 网易云登录后可用的接口
  const res = await fetch(`https://music.163.com/api/v1/user/detail/${uid}`, {
    signal: ctrl.signal,
    headers: { 'User-Agent': UA, Referer: 'https://music.163.com/', Cookie: cookie },
  });
  const raw = await res.text();
  return { status: res.status, text: raw.slice(0, 400) };
}

const TESTS = [
  { name: '微博 (API+cookie)',    fn: () => fetchWeiboApi('7487955617', getCookieHeader('weibo')) },
  { name: '微博 (HTML+cookie)',   fn: () => fetchPage('https://weibo.com/u/7487955617', getCookieHeader('weibo'), 'https://weibo.com/') },
  { name: '豆瓣 (HTML+cookie)',   fn: () => fetchPage('https://www.douban.com/people/225574042/', getCookieHeader('douban'), 'https://www.douban.com/') },
  { name: '网易云 API v1+cookie', fn: () => fetchNeteaseApi('530688535', getCookieHeader('netease')) },
  { name: '网易云 eapi+cookie',   fn: () => (() => { const c = getCookieHeader('netease'); return fetch('https://music.163.com/eapi/v1/user/detail/530688535', { headers: { 'User-Agent': UA, Referer: 'https://music.163.com/', Cookie: c } }).then(r => r.text()).then(t => ({ status: 200, text: t.slice(0,300) })); })() },
  { name: '小红书 (HTML+cookie)', fn: () => fetchPage('https://www.xiaohongshu.com/user/profile/6862f41c000000001e028d0e', getCookieHeader('xhs'), 'https://www.xiaohongshu.com/') },
  { name: '小红书搜索+cookie',    fn: () => fetchPage('https://www.xiaohongshu.com/search_result?keyword=416227302&source=web_explore_feed', getCookieHeader('xhs'), 'https://www.xiaohongshu.com/') },
  { name: '抖音 (HTML+cookie)',   fn: () => fetchPage('https://www.douyin.com/user/self?from_tab_name=main', getCookieHeader('douyin'), 'https://www.douyin.com/') },
];

for (const t of TESTS) {
  process.stdout.write(`\n【${t.name}】...`);
  const r = await t.fn().catch(e => ({ status: 0, text: '', err: e.message }));
  const preview = (r.text || '(空)').replace(/\n/g, ' / ').slice(0, 250);
  console.log(` status=${r.status} len=${r.text?.length ?? 0}${r.err ? ' err='+r.err : ''}`);
  console.log(`  摘录: ${preview}`);
}
