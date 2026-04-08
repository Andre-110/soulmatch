import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: string } | null;
    if (!decoded?.userId) {
      const res = NextResponse.json({ error: '无效Token' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      const res = NextResponse.json({ error: '登录态已失效，请重新登录' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }

    return NextResponse.json(
      { user },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: '读取会话失败' }, { status: 500 });
  }
}
