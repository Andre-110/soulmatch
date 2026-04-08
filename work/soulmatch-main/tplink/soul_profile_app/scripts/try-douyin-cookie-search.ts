/**
 * CLI：登录 Cookie → 抖音用户搜索 → 进入匹配用户主页并输出 JSON。
 *
 *   npx tsx scripts/try-douyin-cookie-search.ts [cookie.json路径] [关键词]
 *
 * 默认关键词 MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ；Cookie 优先 argv[1]，其次 DOUYIN_COOKIE_FILE，否则仓库根目录 cookies (20).json（兼容 19）
 */
import fs from 'fs';
import path from 'path';
import { douyinSearchUsersAndProfileInfo } from '../lib/douyinSearchProfile';

const DEFAULT_KEYWORD = 'MS4wLjABAAAANwkJuWIRFOzg5uCpDRpMj4OX-QryoDgn-yYlXQnRwQQ';

function resolveCookiePath(): string {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  const fromEnv = process.env.DOUYIN_COOKIE_FILE;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  const root = path.join(__dirname, '..', '..', '..');
  const v20 = path.join(root, 'cookies (20).json');
  const v19 = path.join(root, 'cookies (19).json');
  if (fs.existsSync(v20)) return v20;
  return v19;
}

async function main() {
  const cookiePath = resolveCookiePath();
  const keyword = process.argv[3] ?? DEFAULT_KEYWORD;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(__dirname, '..', 'public', 'debug-screenshots', `douyin_${timestamp}`);

  console.log('Cookie:', cookiePath);
  console.log('关键词:', keyword);

  const result = await douyinSearchUsersAndProfileInfo({
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
