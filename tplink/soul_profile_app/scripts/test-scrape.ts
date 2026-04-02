/**
 * 一次性测试：用给定平台绑定数据跑抓取（与 /api/analyze 同源逻辑）
 * 用法：cd soul_profile_app && npx tsx scripts/test-scrape.ts
 */
import fs from 'fs';
import path from 'path';
import { scrapeFromPlatformUploads, scrapeOutcomeToDisplayName } from '../lib/profileScrape';
import {
  tryOpenAISoulReport,
  buildFallbackSoulReport,
  ensureBlocksCoverAllScrapes,
  ensureUserHandUploadBlock,
} from '../lib/soulReportOpenAI';

function loadDotEnv() {
  const p = path.join(process.cwd(), '.env');
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* ignore */
  }
}
loadDotEnv();

const uploads = [
  {
    type: 'platform:xhs',
    content: JSON.stringify({
      profileUrl:
        'https://www.xiaohongshu.com/search_result?keyword=615394701&source=web_explore_feed',
      extractedId: '615394701',
    }),
  },
  {
    type: 'platform:weibo',
    content: JSON.stringify({
      profileUrl: 'https://weibo.com/u/7487955617',
      extractedId: '7487955617',
    }),
  },
  {
    type: 'platform:douyin',
    content: JSON.stringify({
      profileUrl:
        'https://www.douyin.com/user/MS4wLjABAAAA7XRtQu4TUDPsY_Naph7YZwN1iJvUcyf3B9OO6-T2JEajr7oaRr_Ak7C5PLE9z_be',
      extractedId:
        'MS4wLjABAAAA7XRtQu4TUDPsY_Naph7YZwN1iJvUcyf3B9OO6-T2JEajr7oaRr_Ak7C5PLE9z_be',
    }),
  },
  {
    type: 'platform:netease',
    content: JSON.stringify({
      profileUrl: 'https://music.163.com/#/user/home?id=530688535',
      extractedId: '530688535',
    }),
  },
  {
    type: 'platform:douban',
    content: JSON.stringify({
      profileUrl: 'https://www.douban.com/people/225574042/?_i=50534218b74zMc,50946408b74zMc',
      extractedId: '225574042',
    }),
  },
];

async function main() {
  console.log('=== 抓取各平台（含 Playwright 截图）===\n');
  const scrapes = await scrapeFromPlatformUploads(uploads as { type: string; content: string | null }[]);

  for (const o of scrapes) {
    const name = scrapeOutcomeToDisplayName(o);
    const shot = o.screenshotDataUrl ? `有截图 ${Math.round((o.screenshotDataUrl.length / 1024) * 10) / 10} KB (base64)` : '无截图';
    console.log(`【${name}】 ok=${o.ok} method=${o.method ?? '?'}`);
    console.log(`  ${shot}`);
    console.log(`  摘录前 600 字:\n${(o.excerpt || '').slice(0, 600)}${(o.excerpt || '').length > 600 ? '…' : ''}\n`);
  }

  const contextParts: string[] = [
    '以下为 SoulMatch 建档材料：各平台绑定后的抓取摘录、用户在应用内的自述，以及手传截图说明。',
  ];
  for (const o of scrapes) {
    contextParts.push(
      `\n【${scrapeOutcomeToDisplayName(o)}】\n链接：${o.url}\n抓取结果：${o.ok ? '有正文' : '无有效正文'}（${o.method || 'unknown'}）\n正文摘录：\n${o.excerpt || '（空）'}\n`,
    );
  }
  const context = contextParts.join('');

  const platformShotUrls: string[] = scrapes
    .filter((o) => o.screenshotDataUrl)
    .map((o) => o.screenshotDataUrl as string);

  console.log('=== 调用大模型生成灵魂档案（与线上 analyze 一致）===\n');
  let report = await tryOpenAISoulReport(context, platformShotUrls);
  if (!report) {
    console.log('(OPENAI 未返回或缺 KEY，使用 fallback)\n');
    report = buildFallbackSoulReport({ scrapes, userTexts: [], screenshotCount: 0 });
  } else {
    report = ensureBlocksCoverAllScrapes(report, scrapes);
    report = ensureUserHandUploadBlock(report, 0);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
