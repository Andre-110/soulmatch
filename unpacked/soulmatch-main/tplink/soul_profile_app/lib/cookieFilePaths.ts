import fs from 'fs';
import path from 'path';

/**
 * Cookie JSON 所在目录：优先 COOKIES_DIR，再兜底仓库根目录 & tplink/cookies。
 * 即使设了 COOKIES_DIR 也保留兜底，避免文件放错目录导致全部平台丢 cookie。
 */
export function resolveCookieDirs(): string[] {
  const fallbacks = [
    path.join(process.cwd(), '..', '..'),          // 仓库根（如 /home/ecs-user/tplink-app）
    path.join(process.cwd(), '..', 'cookies'),     // tplink/cookies
  ];
  if (process.env.COOKIES_DIR) {
    const primary = path.resolve(process.env.COOKIES_DIR);
    return [primary, ...fallbacks.filter((d) => d !== primary)];
  }
  return fallbacks;
}

/** 按文件名查找第一个存在的 JSON 路径 */
export function findCookieFilePath(filename: string): string | null {
  for (const dir of resolveCookieDirs()) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 抖音：优先新版 cookies (20)，兼容旧版 (19) */
export function findDouyinCookieFilePath(): string | null {
  for (const name of ['cookies (20).json', 'cookies (19).json']) {
    const p = findCookieFilePath(name);
    if (p) return p;
  }
  return null;
}
