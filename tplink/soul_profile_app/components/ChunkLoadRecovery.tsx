'use client';

import { useEffect } from 'react';

const RELOAD_FLAG = 'soulmatch_chunk_reload_once';

/**
 * 部署后若浏览器仍缓存旧 HTML，会请求已不存在的 `/_next/static/chunks/*.js`，触发 ChunkLoadError。
 * 自动刷新一次以拉取新 HTML（仅一次，避免死循环）。
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const shouldReload = (msg: string) =>
      /ChunkLoadError|Loading chunk|Failed to load chunk|\/_next\/static\/chunks/i.test(msg);

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const msg =
        typeof r === 'object' && r !== null && 'message' in r
          ? String((r as Error).message)
          : String(r);
      if (!shouldReload(msg)) return;
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
      e.preventDefault();
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      const msg = e.message || '';
      if (!shouldReload(msg)) return;
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    const clearTimer = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_FLAG);
    }, 10000);

    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
      window.clearTimeout(clearTimer);
    };
  }, []);

  return null;
}
