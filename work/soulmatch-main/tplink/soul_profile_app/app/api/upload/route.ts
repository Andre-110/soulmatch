import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

const SQLITE_BUSY_RETRY_MS = 120;
const SQLITE_BUSY_MAX_RETRIES = 3;

function resolveUploadFilePath(url: string | null): string | null {
  if (!url) return null;
  const normalized = url.replace(/^\/+/, '');
  if (!normalized.startsWith('uploads/')) return null;
  return join(process.cwd(), 'public', normalized);
}

function isSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /database is locked|SQLITE_BUSY/i.test(message);
}

async function withSqliteRetry<T>(label: string, task: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;
      if (!isSqliteBusyError(error) || attempt > SQLITE_BUSY_MAX_RETRIES) throw error;
      console.warn(`[Upload] ${label} retry ${attempt}/${SQLITE_BUSY_MAX_RETRIES} after SQLITE_BUSY`);
      await new Promise((resolve) => setTimeout(resolve, SQLITE_BUSY_RETRY_MS * attempt));
    }
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) {
      const res = NextResponse.json({ error: '无效Token' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }
    const existingUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });
    if (!existingUser) {
      const res = NextResponse.json({ error: '登录态已失效，请重新登录' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const type = formData.get('type') as string;
      const file = formData.get('file') as File;
      const contentStr = formData.get('content') as string; // in case they submit direct text
      console.log(
        `[Upload] multipart userId=${decoded.userId} type=${type || 'screenshot'} file=${file?.name || '-'} size=${file?.size || 0}`,
      );

      let fileUrl = null;
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        const filePath = join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        fileUrl = `/uploads/${fileName}`;
      }

      const upload = await withSqliteRetry('multipart-create', () =>
        prisma.upload.create({
          data: {
            userId: decoded.userId,
            type: type || 'screenshot',
            content: contentStr || null,
            url: fileUrl,
          },
        }),
      );

      return NextResponse.json({ success: true, upload });
    }

    // JSON upload
    const json = await req.json();
    if (typeof json.type !== 'string' || !json.type.trim()) {
      return NextResponse.json({ error: '缺少 type' }, { status: 400 });
    }
    console.log(
      `[Upload] json userId=${decoded.userId} type=${String(json.type || '')} contentLen=${
        typeof json.content === 'string' ? json.content.length : 0
      }`,
    );
    const upload = await withSqliteRetry('json-create', () =>
      prisma.upload.create({
        data: {
          userId: decoded.userId,
          type: json.type,
          content: json.content,
          url: null,
        },
      }),
    );

    return NextResponse.json({ success: true, upload });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Upload] POST failed:', message, error);
    return NextResponse.json(
      {
        error: '保存失败',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) {
      const res = NextResponse.json({ error: '无效Token' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }
    const existingUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });
    if (!existingUser) {
      const res = NextResponse.json({ error: '登录态已失效，请重新登录' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }

    const json = await req.json().catch(() => ({} as { uploadId?: string }));
    const uploadId = typeof json.uploadId === 'string' ? json.uploadId : '';
    if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 });

    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, userId: decoded.userId },
    });
    if (!upload) return NextResponse.json({ error: '图片不存在或无权限' }, { status: 404 });

    await withSqliteRetry('delete', () => prisma.upload.delete({ where: { id: upload.id } }));

    const uploadFilePath = resolveUploadFilePath(upload.url);
    if (uploadFilePath) {
      await unlink(uploadFilePath).catch(() => {
        // 文件已不存在时忽略，数据库记录已删除即可
      });
    }

    return NextResponse.json({ success: true, uploadId: upload.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Upload] DELETE failed:', message, error);
    return NextResponse.json(
      {
        error: '删除失败',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      },
      { status: 500 },
    );
  }
}
