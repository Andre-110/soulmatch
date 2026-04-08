import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 中间件：Edge Runtime 环境，不可使用 Node.js 内置模块（如 os）。
 * 资源监控已移至 API 路由内部（Node.js runtime）。
 */
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
