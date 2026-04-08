/**
 * CLI：小红书分享链 / 主页 URL 直达（无 Cookie）。
 *
 *   npx tsx scripts/try-xhs-share.ts [URL]
 *
 * 默认 URL 为测试用分享链。
 */
import path from 'path';
import { xhsOpenEntryUrlAndProfileExcerpt } from '../lib/xhsSearchProfile';
import { resolveXhsShareLinkToProfileUrl } from '../lib/xhsResolveShareLink';

const DEFAULT_URL = 'https://xhslink.com/m/2q3yn1USahZ';

async function main() {
  const entryUrl = process.argv[2] ?? DEFAULT_URL;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(__dirname, '..', 'public', 'debug-screenshots', `xhs_share_${timestamp}`);

  console.log('entryUrl:', entryUrl);
  const resolved = await resolveXhsShareLinkToProfileUrl(entryUrl);
  if (resolved) {
    console.log('HTTP 解析主页 URL（与 curl 中 href 一致）:', resolved.slice(0, 120) + (resolved.length > 120 ? '…' : ''));
  } else {
    console.log('HTTP 未解析到短链 href，将直接用 entryUrl 打开浏览器');
  }

  const result = await xhsOpenEntryUrlAndProfileExcerpt({
    entryUrl: resolved || entryUrl,
    headless: true,
    screenshotDir: outDir,
  });

  console.log('\n--- 结果 ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n截图目录:', outDir, '（视口截图，文件名 xhs_direct_<时间>.png）');
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
