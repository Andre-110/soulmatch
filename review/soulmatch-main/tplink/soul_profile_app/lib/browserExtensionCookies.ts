/**
 * 浏览器插件（如 EditThisCookie）导出的 JSON Cookie → Playwright addCookies 格式。
 */
import fs from 'fs';

export type BrowserExtensionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
};

export function readBrowserExtensionCookiesFromFile(filePath: string): BrowserExtensionCookie[] {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    return Array.isArray(raw) ? (raw as BrowserExtensionCookie[]) : [];
  } catch {
    return [];
  }
}

export function extensionCookiesToPlaywright(raw: BrowserExtensionCookie[]) {
  return raw
    .filter((c) => c.name && c.value && c.domain)
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || '/',
      secure: c.secure ?? false,
      httpOnly: c.httpOnly ?? false,
      sameSite: (['Strict', 'Lax', 'None'].includes(c.sameSite ?? '')
        ? c.sameSite
        : 'None') as 'Strict' | 'Lax' | 'None',
      expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
    }));
}
