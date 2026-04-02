import fs from 'fs';
import path from 'path';
import type { PlatformKey } from '@/lib/platformUrls';

/** cookies 目录相对于 Next.js 项目根目录（soul_profile_app/）的路径 */
const COOKIES_DIR =
  process.env.COOKIES_DIR ?? path.join(process.cwd(), '..', 'cookies');

/** 平台 → cookie 文件名映射 */
const COOKIE_FILES: Record<PlatformKey, string> = {
  xhs:     'cookies (6).json',
  weibo:   'cookies (7).json',
  douyin:  'cookies (8).json',
  netease: 'cookies (9).json',
  douban:  'cookies (10).json',
};

type RawCookie = { name: string; value: string };

function readCookieFile(platform: PlatformKey): RawCookie[] {
  try {
    const file = path.join(COOKIES_DIR, COOKIE_FILES[platform]);
    const raw = fs.readFileSync(file, 'utf-8');
    const arr = JSON.parse(raw) as RawCookie[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 把 cookie 数组转成 "name=value; name2=value2" 格式的请求头字符串 */
export function getCookieHeader(platform: PlatformKey): string {
  const cookies = readCookieFile(platform);
  return cookies
    .filter((c) => c.name && c.value)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}
