import fs from 'fs';
import type { PlatformKey } from '@/lib/platformUrls';
import { findCookieFilePath, findDouyinCookieFilePath } from '@/lib/cookieFilePaths';

/** 平台 → cookie 文件名映射（抖音优先 cookies (20).json，见 findDouyinCookieFilePath） */
const COOKIE_FILES: Record<PlatformKey, string> = {
  xhs:     'cookies (6).json',
  weibo:   'cookies (7).json',
  douyin:  'cookies (20).json',
  netease: 'cookies (9).json',
  douban:  'cookies (10).json',
  zhihu:   'cookies (11).json',
};

type RawCookie = { name: string; value: string };

function readCookieFile(platform: PlatformKey): RawCookie[] {
  try {
    const file =
      platform === 'douyin' ? findDouyinCookieFilePath() : findCookieFilePath(COOKIE_FILES[platform]);
    if (!file) return [];
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
