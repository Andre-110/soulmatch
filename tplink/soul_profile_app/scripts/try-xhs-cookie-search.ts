/**
 * CLI：登录 Cookie → 小红书用户搜索 → 进入匹配用户主页并输出 JSON。
 *
 *   npx tsx scripts/try-xhs-cookie-search.ts [cookie.json路径] [关键词]
 *
 * 默认关键词 416227302；Cookie 优先 argv[1]，其次 XHS_COOKIE_FILE，否则仓库根目录 cookies (18).json
 */
import fs from 'fs';
import path from 'path';
import { xhsSearchUsersAndProfileInfo } from '../lib/xhsSearchProfile';

const DEFAULT_KEYWORD = '416227302';

function resolveCookiePath(): string {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const fromEnv = process.env.XHS_COOKIE_FILE;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  return path.join(__dirname, '..', '..', '..', 'cookies (18).json');
}

async function main() {
  const cookiePath = resolveCookiePath();
  const keyword = process.argv[3] ?? DEFAULT_KEYWORD;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(__dirname, '..', 'public', 'debug-screenshots', `xhs_${timestamp}`);

  console.log('Cookie:', cookiePath);
  console.log('关键词:', keyword);

  const result = await xhsSearchUsersAndProfileInfo({
    cookiePath,
    keyword,
    openFirstProfile: true,
    screenshotDir: outDir,
    headless: true,
  });

  console.log('\n--- 结果 ---');
  console.log(JSON.stringify(result, null, 2));
  if (result.error) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
