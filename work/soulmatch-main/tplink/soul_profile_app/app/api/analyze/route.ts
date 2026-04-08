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
import {
  buildProfileNormalizedCreate,
  soulReportFromNormalized,
} from '@/lib/profilePersist';
import { buildSoulReportInputRecord } from '@/lib/soulReportRecord';
import fs from 'fs';
import path from 'path';
import { resolveMbtiIpFromReport } from '@/lib/mbtiIpIndex';
import { resourceMonitor } from '@/lib/resourceMonitor';
import { AnalyzeStageKey } from '@/lib/analyzeStages';
import { recordAnalyzeStageDuration } from '@/lib/analyzeTiming';
import type { AnalyzeSnapshot } from '@/lib/api/stream';

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

const MAX_USER_TEXTS = 6;
const MAX_SCRAPE_EXCERPT_CHARS = 2200;
const MAX_PLATFORM_SHOTS_FOR_VISION = 4;
const MAX_USER_SHOTS_FOR_VISION = 4;
const SHOULD_ENFORCE_RESOURCE_GUARD = process.env.ENFORCE_RESOURCE_GUARD === '1';

function normalizeSubmissionStartedAt(ts?: number): Date | null {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null;
  // SQLite CURRENT_TIMESTAMP is second-granularity; floor the client timestamp
  // so uploads created in the same second are not filtered out accidentally.
  return new Date(Math.floor(ts / 1000) * 1000);
}

function clipForContext(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

function pickQuestionLines(summary: string, ids: number[]): string[] {
  if (!summary.trim()) return [];
  const chunks = summary
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.filter((chunk) => ids.some((id) => chunk.startsWith(`Q${id}【`) || chunk.startsWith(`Q${id}：`)));
}

function pickLatestPlatformUploads(uploads: UploadRow[]): UploadRow[] {
  const latestByType = new Map<string, UploadRow>();
  for (const u of uploads) {
    if (!u.type.startsWith('platform:')) continue;
    latestByType.set(u.type, u);
  }
  return [...latestByType.values()];
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const decoded = verifyToken(token) as { userId?: string } | null;
    if (!decoded?.userId) return NextResponse.json({ error: '无效Token' }, { status: 401 });

    const health = await resourceMonitor.check();
    if (SHOULD_ENFORCE_RESOURCE_GUARD && (health.level === 'kill' || health.level === 'critical')) {
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
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existingUser) {
      const res = NextResponse.json({ error: '登录态已失效，请重新登录' }, { status: 401 });
      res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 0, path: '/' });
      return res;
    }
    let analyzePayload: {
      submissionStartedAt?: number;
      questionnaireSummary?: string;
      openTextSummary?: string;
      matchIntentText?: string;
    } = {};
    try {
      analyzePayload = (await req.json().catch(() => ({}))) as {
        submissionStartedAt?: number;
        questionnaireSummary?: string;
        openTextSummary?: string;
        matchIntentText?: string;
      };
    } catch {
      analyzePayload = {};
    }
    const submissionStartedAt = normalizeSubmissionStartedAt(analyzePayload.submissionStartedAt);
    const inlineQuestionnaireSummary = (analyzePayload.questionnaireSummary || '').trim();
    const inlineOpenTextSummary = (analyzePayload.openTextSummary || '').trim();
    const inlineMatchIntent = (analyzePayload.matchIntentText || '').trim();
    const encoder = new TextEncoder();
    async function loadCachedProfile() {
      if (submissionStartedAt) return null;
      const lastProfile = await prisma.profile.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          inputScreenshotUrls: { orderBy: { sortOrder: 'asc' } },
          outputBlocks: { orderBy: { sortOrder: 'asc' } },
        },
      });
      if (!lastProfile) return null;
      const uploadsAfter =
        await prisma.upload.count({
          where: { userId, createdAt: { gt: lastProfile.createdAt } },
        });
      if (uploadsAfter > 0) return null;
      return lastProfile;
    }
    /** 长任务期间定时输出一行 JSON，避免 Nginx/反代因「长时间无响应」返回 502 */
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        let lastSnapshot: AnalyzeSnapshot = {};
        const stageStartTimes: Partial<Record<AnalyzeStageKey, number>> = {};
        let currentStage: AnalyzeStageKey | null = null;
        const emitSnapshot = (patch: AnalyzeSnapshot) => {
          lastSnapshot = {
            ...lastSnapshot,
            ...patch,
            submission: patch.submission ?? lastSnapshot.submission,
            scrape: patch.scrape ?? lastSnapshot.scrape,
            vision: patch.vision ?? lastSnapshot.vision,
            output: patch.output ?? lastSnapshot.output,
          };
          emit({ type: 'snapshot', snapshot: lastSnapshot });
        };
        const finalizeStage = (stage: AnalyzeStageKey, now = Date.now()) => {
          const start = stageStartTimes[stage];
          if (!start || stage === 'done') return;
          delete stageStartTimes[stage];
          const durationMs = now - start;
          const aggregated = recordAnalyzeStageDuration(stage, durationMs);
          emit({
            type: 'stageDuration',
            stage,
            durationMs,
            aggregated,
          });
        };
        const emitStage = (stage: AnalyzeStageKey, message: string) => {
          const now = Date.now();
          if (currentStage && currentStage !== stage) finalizeStage(currentStage, now);
          if (stage !== 'done') stageStartTimes[stage] = now;
          currentStage = stage;
          emit({ type: 'stage', stage, message });
        };
        const finalizeCurrentStage = () => {
          if (currentStage && currentStage !== 'done') finalizeStage(currentStage);
          currentStage = null;
        };
        controller.enqueue(encoder.encode('{"type":"ack"}\n'));
        emitStage('queued', '已接收请求，准备开始分析…');
        const pingIv = setInterval(() => {
          try {
            controller.enqueue(encoder.encode('{"type":"ping"}\n'));
          } catch {
            clearInterval(pingIv);
          }
        }, 12_000);
        try {
          const cachedProfile = await loadCachedProfile();
          if (cachedProfile) {
            finalizeStage('queued');
            emitStage('done', '重用最近一次分析结果');
            emitSnapshot({
              output: {
                source: 'cache',
                model: null,
              },
            });
            const resultData = cachedProfile.resultData
              ? JSON.parse(cachedProfile.resultData)
              : null;
            const report = soulReportFromNormalized({
              outputMbti: cachedProfile.outputMbti,
              outputTitle: cachedProfile.outputTitle,
              outputOverall: cachedProfile.outputOverall,
              outputAvatarTag1: cachedProfile.outputAvatarTag1,
              outputAvatarTag2: cachedProfile.outputAvatarTag2,
              outputAvatarTag3: cachedProfile.outputAvatarTag3,
              outputBlocks: cachedProfile.outputBlocks,
            });
            const analysisResult = {
              ...report,
              article: resultData?.article,
            };
            const mbtiIp = resolveMbtiIpFromReport(report.mbti);
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'done',
                  success: true,
                  report: { ...analysisResult, mbtiIp },
                  userScreenshotUrls: cachedProfile.inputScreenshotUrls.map((item) => item.url).filter((u): u is string => !!u),
                  mbtiIp,
                }) + '\n',
              ),
            );
            clearInterval(pingIv);
            controller.close();
            return;
          }
      const payload = await runAnalyzeTask(userId, async () => {
            emitStage('gathering', '正在整理你刚刚提交的素材…');
      const uploads = await prisma.upload.findMany({
        where: {
          userId,
          ...(submissionStartedAt ? { createdAt: { gte: submissionStartedAt } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      const platformUploadsLatest = pickLatestPlatformUploads(uploads);
      emitSnapshot({
        submission: {
          startedAt: submissionStartedAt?.toISOString() ?? null,
          totalUploads: uploads.length,
          platformBindings: platformUploadsLatest.length,
          userScreenshots: uploads.filter((u) => u.type === 'screenshot' && u.url).length,
          textEntries:
            uploads.filter((u) => u.type === 'text' || u.type === 'voice-text').length
            + (inlineQuestionnaireSummary ? 1 : 0)
            + (inlineOpenTextSummary ? 1 : 0),
          hasMatchIntent:
            uploads.some((u) => u.type === 'match-intent' && (u.content || '').trim().length > 0)
            || Boolean(inlineMatchIntent),
        },
      });
      emitStage('scraping', '正在连接平台并提取可用线索…');
      const scrapes = await scrapeFromPlatformUploads(platformUploadsLatest);
      emitSnapshot({
        scrape: {
          requestedPlatforms: platformUploadsLatest.length,
          succeededPlatforms: scrapes.filter((o) => o.ok && (o.excerpt || '').trim()).length,
          failedPlatforms: scrapes.filter((o) => !o.ok || !(o.excerpt || '').trim()).length,
        },
      });
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
        .slice(0, MAX_USER_TEXTS);
      if (inlineQuestionnaireSummary && !seenTexts.has(inlineQuestionnaireSummary)) {
        seenTexts.add(inlineQuestionnaireSummary);
        userTexts.unshift(inlineQuestionnaireSummary);
      }
      if (inlineOpenTextSummary && !seenTexts.has(inlineOpenTextSummary)) {
        seenTexts.add(inlineOpenTextSummary);
        userTexts.push(inlineOpenTextSummary);
      }
      const mergedUserTexts = userTexts.slice(0, MAX_USER_TEXTS);
      const matchIntent =
        [...uploads]
          .reverse()
          .find((u) => u.type === 'match-intent' && (u.content || '').trim())?.content?.trim() ?? inlineMatchIntent;

      const screenshotCount = uploads.filter((u) => u.type === 'screenshot' && u.url).length;
      const questionnaireIdentity = pickQuestionLines(inlineQuestionnaireSummary, [1, 2, 3, 4, 5, 6, 7, 8]);
      const questionnaireValues = pickQuestionLines(inlineQuestionnaireSummary, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
      const questionnaireLifestyle = pickQuestionLines(inlineQuestionnaireSummary, [21, 22, 23, 24, 25, 26]);
      const questionnaireDailyScenes = pickQuestionLines(inlineQuestionnaireSummary, [27, 28, 29, 30]);

      const contextParts: string[] = [
        '以下为 SoulMatch 建档材料：各平台绑定后的抓取摘录、用户在应用内的自述，以及手传截图说明。【多模态图片顺序】本请求附带的图片依次为：先按抓取顺序排列的各平台 Playwright 截图（每个绑定源至多一张，无则跳过），再按上传时间顺序的建档步骤手传截图。解读「你上传的截图·视觉线索」时请以该顺序后半段、与【用户手传截图】张数对应的图片为准，勿与平台截图混淆。',
        `\n【本次输入边界】\n本次真实输入包含：${mergedUserTexts.length} 段问卷/自述文本、${platformUploadsLatest.length} 个平台绑定、${screenshotCount} 张用户手传截图。\n除固定展示框架（如晨起/午餐/阅读这些时段名和时间）外，其余任何歌名、地点、食物、书名、职业、来源标签，都必须来自以上真实输入。\n若输入里没有某个具体名词，禁止脑补；必须明确写“材料未显示具体名称”或改写为保守表达。\n若 screenshotCount = 0，则严禁出现“你的生活照片 / 你上传的截图 / 手传图显示”等说法。\n`,
        '\n【问卷融入规则】\n不要单独再造一整页“问卷分析”，而是把 30 题合理融入现有模块：\n1. overall / avatarTags：优先吸收 Q1-Q8 的自我标签、关系目标、基本身份与择偶边界；\n2. mbti / section3：优先吸收 Q9-Q26 的价值观、边界感、独处社交、消费、作息、探索欲；\n3. section2 名人匹配：优先吸收 Q4、Q8、Q12、Q14、Q17、Q18、Q19、Q22、Q25 体现出的相处模式；\n4. section4 六段分身一天：优先吸收 Q21-Q30 的作息、周二晚上、周末安排、恋爱雷区、小确幸；\n5. finalCard：至少有 1 行明确体现问卷里的关系目标或生活节奏。\n不要把问卷藏没了，也不要逐题复读；要像把骨架融进肉里。\n',
      ];
      if (questionnaireIdentity.length > 0) {
        contextParts.push(`\n【问卷高信号·身份与自我定义】\n${questionnaireIdentity.join('\n\n')}\n`);
      }
      if (questionnaireValues.length > 0) {
        contextParts.push(`\n【问卷高信号·关系价值观与边界】\n${questionnaireValues.join('\n\n')}\n`);
      }
      if (questionnaireLifestyle.length > 0) {
        contextParts.push(`\n【问卷高信号·生活节奏与社交偏好】\n${questionnaireLifestyle.join('\n\n')}\n`);
      }
      if (questionnaireDailyScenes.length > 0) {
        contextParts.push(`\n【问卷高信号·日常场景素材】\n${questionnaireDailyScenes.join('\n\n')}\n`);
      }
      for (const o of scrapes) {
        contextParts.push(
          `\n【${scrapeOutcomeToDisplayName(o)}】\n链接：${o.url}\n抓取结果：${o.ok ? '有正文' : '无有效正文'}（${o.method || 'unknown'}）\n正文摘录：\n${clipForContext(o.excerpt || '（空）', MAX_SCRAPE_EXCERPT_CHARS)}\n`,
        );
      }
      for (const t of mergedUserTexts) {
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
          `\n【用户手传截图】共 ${screenshotCount} 张（建档第一步上传，已随本请求以图片消息附在文字材料之后）。为了控制时延，本次会抽取其中最多 ${MAX_USER_SHOTS_FOR_VISION} 张代表图进入视觉分析，但报告里仍要保留独立 block（source 含「你上传的截图·视觉线索」），描述整体可见的界面、文字与气质。\n`,
        );
      }
      const context = contextParts.join('');

      // 平台截图（Playwright 抓取的）→ 再拼接用户手传图；二者顺序须与 context 说明一致
      const platformShotsWithKey = scrapes
        .filter((o) => o.screenshotDataUrl)
        .slice(0, MAX_PLATFORM_SHOTS_FOR_VISION)
        .map((o) => ({ key: o.platform, dataUrl: o.screenshotDataUrl as string }));
      const screenshotKeys: string[] = platformShotsWithKey.map((p) => p.key);
      const screenshotDataUrls: string[] = platformShotsWithKey.map((p) => p.dataUrl);

      for (const [index, s] of userScreenshots.slice(0, MAX_USER_SHOTS_FOR_VISION).entries()) {
        try {
          const rel = (s.url || '').replace(/^\/+/, '');
          if (!rel.startsWith('uploads/')) continue;
          const filePath = path.join(process.cwd(), 'public', rel);
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(s.url!).slice(1).toLowerCase() || 'png';
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
          screenshotKeys.push(`user_upload_${index + 1}`);
          screenshotDataUrls.push(`data:${mime};base64,${buf.toString('base64')}`);
        } catch { /* 文件不存在则跳过 */ }
      }
      emitSnapshot({
        vision: {
          selectedImages: screenshotDataUrls.length,
          userUploadImages: userScreenshots.slice(0, MAX_USER_SHOTS_FOR_VISION).length,
          platformImages: platformShotsWithKey.length,
        },
      });

      const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      emitStage(
        'vision',
        screenshotDataUrls.length > 0
          ? `正在解读 ${screenshotDataUrls.length} 张截图里的视觉细节…`
          : '当前没有可用截图，跳过视觉分析，直接整理文本与主页线索…',
      );
      emitStage(
        'prompting',
        process.env.OPENAI_API_KEY
          ? `AI 正在生成你的画像与报告…（模型：${openaiModel}）`
          : '当前未配置 AI 模型，正在使用基础兜底报告模板…',
      );
      const evidenceText = [
        ...scrapes.map((o) => `${o.platform} ${o.url} ${o.excerpt || ''}`),
        ...mergedUserTexts,
        matchIntent || '',
      ].join('\n');

      let report = await tryOpenAISoulReport(context, screenshotDataUrls, screenshotKeys, scrapes, {
        evidenceText,
        screenshotCount,
      });
      const reportSource = report ? 'openai' : 'fallback';
      emitSnapshot({
        output: {
          source: reportSource,
          model: reportSource === 'openai' ? openaiModel : null,
        },
      });
      if (!report) {
        report = buildFallbackSoulReport({ scrapes, userTexts: mergedUserTexts, screenshotCount });
      } else {
        report = ensureBlocksCoverAllScrapes(report, scrapes);
        report = ensureUserHandUploadBlock(report, screenshotCount);
      }
      report = applyScrapeEvidenceToBlocks(report, scrapes);

      const inputRecord = buildSoulReportInputRecord({
        uploads,
        scrapes,
        userTexts: mergedUserTexts,
        userScreenshotUrls,
        screenshotCount,
        visionImageCount: screenshotDataUrls.length,
        context,
        reportSource,
        openaiModel: reportSource === 'openai' ? openaiModel : undefined,
      });

      emitStage('saving', '正在整理结构并写入档案…');
      await prisma.profile.create({
        data: buildProfileNormalizedCreate({
          userId,
          input: inputRecord,
          report,
        }),
      });

      const mbtiIp = resolveMbtiIpFromReport(report.mbti);
      emitStage('done', '灵魂档案已生成完成');
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
          finalizeCurrentStage();
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
