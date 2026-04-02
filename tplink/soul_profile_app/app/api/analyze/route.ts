import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { scrapeFromPlatformUploads, scrapeOutcomeToDisplayName } from '@/lib/profileScrape';
import {
  buildFallbackSoulReport,
  ensureBlocksCoverAllScrapes,
  ensureUserHandUploadBlock,
  tryOpenAISoulReport,
} from '@/lib/soulReportOpenAI';
import fs from 'fs';
import path from 'path';

/** 抓取多站主页可能较慢（含 Reader 回退） */
export const maxDuration = 120;

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: string } | null;
    if (!decoded?.userId) return NextResponse.json({ error: '无效Token' }, { status: 401 });

    const uploads = await prisma.upload.findMany({
      where: { userId: decoded.userId },
      orderBy: { createdAt: 'asc' },
    });

    const scrapes = await scrapeFromPlatformUploads(uploads);

    const userTexts = uploads
      .filter((u) => u.type === 'text' || u.type === 'voice-text')
      .map((u) => u.content || '')
      .filter(Boolean);

    const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;

    const contextParts: string[] = [
      '以下为 SoulMatch 建档材料：各平台绑定后的抓取摘录、用户在应用内的自述，以及手传截图说明。【多模态图片顺序】本请求附带的图片依次为：先按抓取顺序排列的各平台 Playwright 截图（每个绑定源至多一张，无则跳过），再按上传时间顺序的建档步骤手传截图。解读「你上传的截图·视觉线索」时请以该顺序后半段、与【用户手传截图】张数对应的图片为准，勿与平台截图混淆。',
    ];
    for (const o of scrapes) {
      contextParts.push(
        `\n【${scrapeOutcomeToDisplayName(o)}】\n链接：${o.url}\n抓取结果：${o.ok ? '有正文' : '无有效正文'}（${o.method || 'unknown'}）\n正文摘录：\n${o.excerpt || '（空）'}\n`
      );
    }
    for (const t of userTexts) {
      contextParts.push(`\n【用户自述】\n${t}\n`);
    }
    const userScreenshots = uploads.filter((u) => u.type === 'screenshot' && u.url);
    const userScreenshotUrls = userScreenshots.map((u) => u.url).filter((u): u is string => !!u);

    if (screenshotCount > 0) {
      contextParts.push(
        `\n【用户手传截图】共 ${screenshotCount} 张（建档第一步上传，已随本请求以图片消息附在文字材料之后）。必须为这些图片写一个独立 block（source 含「你上传的截图·视觉线索」），描述可见的界面、文字与气质。\n`,
      );
    }
    const context = contextParts.join('');

    // 平台截图（Playwright 抓取的）→ 再拼接用户手传图；二者顺序须与 context 说明一致
    const platformShotUrls: string[] = scrapes
      .filter((o) => o.screenshotDataUrl)
      .map((o) => o.screenshotDataUrl as string);
    const screenshotDataUrls: string[] = [...platformShotUrls];

    for (const s of userScreenshots) {
      try {
        const rel = (s.url || '').replace(/^\/+/, '');
        if (!rel.startsWith('uploads/')) continue;
        const filePath = path.join(process.cwd(), 'public', rel);
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(s.url!).slice(1).toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        screenshotDataUrls.push(`data:${mime};base64,${buf.toString('base64')}`);
      } catch { /* 文件不存在则跳过 */ }
    }

    let report = await tryOpenAISoulReport(context, screenshotDataUrls);
    if (!report) {
      report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
    } else {
      report = ensureBlocksCoverAllScrapes(report, scrapes);
      report = ensureUserHandUploadBlock(report, screenshotCount);
    }

    await prisma.profile.create({
      data: {
        userId: decoded.userId,
        resultData: JSON.stringify(report),
      },
    });

    return NextResponse.json({ success: true, report, userScreenshotUrls });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '分析生成失败' }, { status: 500 });
  }
}
