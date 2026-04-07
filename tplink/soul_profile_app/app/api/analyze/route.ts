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
  applyScrapeEvidenceToBlocks,
  buildFallbackSoulReport,
  ensureBlocksCoverAllScrapes,
  ensureUserHandUploadBlock,
  tryOpenAISoulReport,
} from '@/lib/soulReportOpenAI';
import { runAnalyzeTask, AnalyzeInProgressError } from '@/lib/analyzeQueue';
import { buildProfileNormalizedCreate } from '@/lib/profilePersist';
import { buildSoulReportInputRecord } from '@/lib/soulReportRecord';
import fs from 'fs';
import path from 'path';
import { resolveMbtiIpFromReport } from '@/lib/mbtiIpIndex';
import { resourceMonitor } from '@/lib/resourceMonitor';

/** 抓取多站主页可能较慢（含 Reader 回退 + 双轮模型调用） */
export const maxDuration = 300;

type UploadRow = {
  id: string;
  userId: string;
  type: string;
  content: string | null;
  url: string | null;
  createdAt: Date;
};

function pickLatestPlatformUploads(uploads: UploadRow[]): UploadRow[] {
  const latestByType = new Map<string, UploadRow>();
  for (const u of uploads) {
    if (!u.type.startsWith('platform:')) continue;
    latestByType.set(u.type, u);
  }
  return [...latestByType.values()];
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: string } | null;
    if (!decoded?.userId) return NextResponse.json({ error: '无效Token' }, { status: 401 });

    const health = await resourceMonitor.check();
    if (health.level === 'kill' || health.level === 'critical') {
      return NextResponse.json(
        {
          error: '服务器正在高负载保护中，请 20 秒后重试',
          metrics: {
            cpu: `${health.metrics.cpuUsage.toFixed(1)}%`,
            memory: `${health.metrics.memoryUsage.toFixed(1)}%`,
          },
        },
        { status: 503 },
      );
    }

    const userId = decoded.userId;
    const encoder = new TextEncoder();
    /** 长任务期间定时输出一行 JSON，避免 Nginx/反代因「长时间无响应」返回 502 */
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        controller.enqueue(encoder.encode('{"type":"ack"}\n'));
        emit({ type: 'stage', stage: 'queued', message: '已接收请求，准备开始分析…' });
        const pingIv = setInterval(() => {
          try {
            controller.enqueue(encoder.encode('{"type":"ping"}\n'));
          } catch {
            clearInterval(pingIv);
          }
        }, 12_000);
        try {
          const payload = await runAnalyzeTask(userId, async () => {
      emit({ type: 'stage', stage: 'gathering', message: '正在整理你刚刚提交的素材…' });
      const uploads = await prisma.upload.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      const platformUploadsLatest = pickLatestPlatformUploads(uploads);
      emit({ type: 'stage', stage: 'scraping', message: '正在连接平台并提取可用线索…' });
      const scrapes = await scrapeFromPlatformUploads(platformUploadsLatest);
      console.log(
        `[Analyze] userId=${userId} 全量上传=${uploads.length}，平台去重后=${platformUploadsLatest.length}，抓取摘要: ${summarizeScrapesForLog(scrapes)}`,
      );

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
      const matchIntent =
        [...uploads]
          .reverse()
          .find((u) => u.type === 'match-intent' && (u.content || '').trim())?.content?.trim() ?? '';

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
      if (matchIntent) {
        contextParts.push(
          `\n【交友偏好】\n用户这次更想找：${matchIntent}。在输出匹配建议、关系氛围与适合对象时，请优先贴合这个目标，不要泛泛而谈。\n`,
        );
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
      emit({ type: 'stage', stage: 'vision', message: '正在解读截图里的视觉细节…' });
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
      emit({ type: 'stage', stage: 'prompting', message: 'AI 正在生成你的画像与匹配建议…' });
      let report = await tryOpenAISoulReport(context, screenshotDataUrls, platformShotKeys, scrapes);
      const reportSource = report ? 'openai' : 'fallback';
      if (!report) {
        report = buildFallbackSoulReport({ scrapes, userTexts, screenshotCount });
      } else {
        report = ensureBlocksCoverAllScrapes(report, scrapes);
        report = ensureUserHandUploadBlock(report, screenshotCount);
      }
      report = applyScrapeEvidenceToBlocks(report, scrapes);

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

      emit({ type: 'stage', stage: 'saving', message: '正在整理结构并写入档案…' });
      await prisma.profile.create({
        data: buildProfileNormalizedCreate({
          userId,
          input: inputRecord,
          report,
        }),
      });

      const mbtiIp = resolveMbtiIpFromReport(report.mbti);
      return { success: true as const, report, userScreenshotUrls, mbtiIp };
          });
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'done',
                success: true,
                report: payload.report,
                userScreenshotUrls: payload.userScreenshotUrls,
                mbtiIp: payload.mbtiIp,
              }) + '\n',
            ),
          );
        } catch (error) {
          if (error instanceof AnalyzeInProgressError) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'error',
                  status: 409,
                  error: '正在分析中，请勿重复提交',
                }) + '\n',
              ),
            );
          } else {
            console.error(error);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'error', status: 500, error: '分析生成失败' }) + '\n',
              ),
            );
          }
        } finally {
          clearInterval(pingIv);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, no-transform',
        Connection: 'keep-alive',
        // nginx：关闭缓冲，让 ping 及时传到客户端，避免 60s 空闲断开
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof AnalyzeInProgressError) {
      return NextResponse.json({ error: '正在分析中，请勿重复提交' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: '分析生成失败' }, { status: 500 });
  }
}
