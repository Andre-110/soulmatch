import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';

const DEBUG_EMAIL = 'debug@soulmatch.local';
const DEBUG_PASSWORD = 'debug123456';
const DEBUG_NAME = 'debug';

export async function POST() {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: DEBUG_EMAIL },
    });

    const hashedPassword = await bcrypt.hash(DEBUG_PASSWORD, 10);
    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            name: existingUser.name || DEBUG_NAME,
          },
        })
      : await prisma.user.create({
          data: {
            email: DEBUG_EMAIL,
            password: hashedPassword,
            name: DEBUG_NAME,
          },
        });

    const token = signToken({ userId: user.id });
    const res = NextResponse.json({
      message: 'Debug 会话已重建',
      user: { id: user.id, name: user.name, email: user.email },
    });
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DebugSession] bootstrap failed:', message, error);
    return NextResponse.json({ error: 'Debug 会话创建失败' }, { status: 500 });
  }
}
