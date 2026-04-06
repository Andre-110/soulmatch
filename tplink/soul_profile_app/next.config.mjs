import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 关闭文件追踪，避免构建时 OOM（自托管不需要此功能）
  outputFileTracing: false,
  async headers() {
    return [
      {
        // 所有 HTML 页面不缓存，防止部署后浏览器加载旧 chunk 引用导致 404
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
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
