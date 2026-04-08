import type { NextResponse } from 'next/server';

function isLocalHttpHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1';
}

export function shouldUseSecureCookie(req?: Request): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  try {
    const url = new URL(req.url);
    if (url.protocol !== 'https:' && isLocalHttpHost(url.hostname)) return false;
    return url.protocol === 'https:' || process.env.NODE_ENV === 'production';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export function setAuthTokenCookie(res: NextResponse, token: string, req?: Request) {
  res.cookies.set('token', token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(req),
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export function clearAuthTokenCookie(res: NextResponse, req?: Request) {
  res.cookies.set('token', '', {
    httpOnly: true,
    secure: shouldUseSecureCookie(req),
    maxAge: 0,
    path: '/',
  });
}
