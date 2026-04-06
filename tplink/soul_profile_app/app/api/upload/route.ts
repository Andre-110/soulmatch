import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

function resolveUploadFilePath(url: string | null): string | null {
  if (!url) return null;
  const normalized = url.replace(/^\/+/, '');
  if (!normalized.startsWith('uploads/')) return null;
  return join(process.cwd(), 'public', normalized);
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) return NextResponse.json({ error: '无效Token' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const type = formData.get('type') as string;
      const file = formData.get('file') as File;
      const contentStr = formData.get('content') as string; // in case they submit direct text

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

      const upload = await prisma.upload.create({
        data: {
          userId: decoded.userId,
          type: type || 'screenshot',
          content: contentStr || null,
          url: fileUrl
        }
      });

      return NextResponse.json({ success: true, upload });
    }

    // JSON upload
    const json = await req.json();
    const upload = await prisma.upload.create({
      data: {
        userId: decoded.userId,
        type: json.type,
        content: json.content,
        url: null
      }
    });

    return NextResponse.json({ success: true, upload });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as any;
    if (!decoded || !decoded.userId) return NextResponse.json({ error: '无效Token' }, { status: 401 });

    const json = await req.json().catch(() => ({} as { uploadId?: string }));
    const uploadId = typeof json.uploadId === 'string' ? json.uploadId : '';
    if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 });

    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, userId: decoded.userId },
    });
    if (!upload) return NextResponse.json({ error: '图片不存在或无权限' }, { status: 404 });

    await prisma.upload.delete({ where: { id: upload.id } });

    const uploadFilePath = resolveUploadFilePath(upload.url);
    if (uploadFilePath) {
      await unlink(uploadFilePath).catch(() => {
        // 文件已不存在时忽略，数据库记录已删除即可
      });
    }

    return NextResponse.json({ success: true, uploadId: upload.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
