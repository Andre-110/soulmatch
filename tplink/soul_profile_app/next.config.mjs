import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        // 静态 MBTI 图片允许浏览器缓存 24h，避免重启期间抖动导致 broken image
        source: '/mbti-ip/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600',
          },
        ],
      },
      {
        // 其余页面/资源不缓存，防止部署后浏览器加载旧 chunk 引用导致 404
        source: '/((?!_next/static|_next/image|favicon.ico|mbti-ip).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
