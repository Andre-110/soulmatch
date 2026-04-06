import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  scrapeFromPlatformUploads,
  scrapeOutcomeToDisplayName,
  summarizeScrapesForLog,
} from '@/lib/profileScrape';
import {
  buildFallbackSoulReport,
  ensureBlocksCoverAllScrapes,
  ensureUserHandUploadBlock,
  tryOpenAISoulReport,
} from '@/lib/soulReportOpenAI';
import { buildProfileNormalizedCreate } from '@/lib/profilePersist';
import { buildSoulReportInputRecord } from '@/lib/soulReportRecord';
import fs from 'fs';
import path from 'path';
import { resolveMbtiIpFromReport } from '@/lib/mbtiIpIndex';

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
    console.log(`[Analyze] userId=${decoded.userId} 抓取摘要: ${summarizeScrapesForLog(scrapes)}`);

    // 去重：相同内容只保留第一条（避免 debug 模式多次写入同一段文字）
    const seenTexts = new Set<string>();
    const userTexts = uploads
      .filter((u) => u.type === 'text' || u.type === 'voice-text')
      .map((u) => (u.content || '').trim())
      .filter((t) => {
        if (!t || seenTexts.has(t)) return false;
        seenTexts.add(t);
        return true;
      })
      .slice(0, 10);  // 最多 10 条，防止塞爆 context

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
    const platformShotsWithKey = scrapes
      .filter((o) => o.screenshotDataUrl)
      .map((o) => ({ key: o.platform, dataUrl: o.screenshotDataUrl as string }));
    const platformShotKeys: string[] = platformShotsWithKey.map((p) => p.key);
    const screenshotDataUrls: string[] = platformShotsWithKey.map((p) => p.dataUrl);

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

    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    let report = await tryOpenAISoulReport(context, screenshotDataUrls, platformShotKeys);
    const reportSource = report ? 'openai' : 'fallback';
    if (!report) {
      report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
    } else {
      report = ensureBlocksCoverAllScrapes(report, scrapes);
      report = ensureUserHandUploadBlock(report, screenshotCount);
    }

    const inputRecord = buildSoulReportInputRecord({
      uploads,
      scrapes,
      userTexts,
      userScreenshotUrls,
      screenshotCount,
      visionImageCount: screenshotDataUrls.length,
      context,
      reportSource,
      openaiModel: reportSource === 'openai' ? openaiModel : undefined,
    });

    await prisma.profile.create({
      data: buildProfileNormalizedCreate({
        userId: decoded.userId,
        input: inputRecord,
        report,
      }),
    });

    const mbtiIp = resolveMbtiIpFromReport(report.mbti);
    return NextResponse.json({ success: true, report, userScreenshotUrls, mbtiIp });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '分析生成失败' }, { status: 500 });
  }
}
