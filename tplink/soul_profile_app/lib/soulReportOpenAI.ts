import type { ScrapeOutcome } from '@/lib/profileScrape';
import { scrapeOutcomeToDisplayName } from '@/lib/profileScrape';
import type { SoulReportArticle } from '@/lib/soulReportArticle';
import { isCompleteSoulReportArticle, stubArticleFromLegacy } from '@/lib/soulReportArticle';
import { getSoulReportSystemPrompt } from '@/lib/soulReportPrompt';

export type SoulReport = {
  mbti: string;
  title: string;
  avatarTags: string[];
  blocks: {
    source: string;
    icon: string;
    tags: string[];
    title: string;
    description: string;
  }[];
  /** 供卡片/首屏的浓缩总评（与 article 互补，勿与 article 逐字重复） */
  overall: string;
  /** 与「全维度精准解码」长文模板对齐的结构化正文；缺失时由兜底或脚本从 blocks 生成 */
  article?: SoulReportArticle;
};

function blockIcon(platform: string): string {
  if (platform === 'netease' || platform === 'douyin') return '🎵';
  if (platform === 'douban') return '🎬';
  if (platform === 'weibo') return '👀';
  return '📕';
}

export function buildFallbackSoulReport(params: {
  scrapes: ScrapeOutcome[];
  userTexts: string[];
  screenshotCount: number;
}): SoulReport {
  const { scrapes, userTexts, screenshotCount } = params;
  const blocks: SoulReport['blocks'] = scrapes.map((o) => ({
    source: `${scrapeOutcomeToDisplayName(o)} · 公开页摘录`,
    icon: blockIcon(o.platform),
    tags: o.ok ? ['公开信息'] : ['暂未能读取'],
    title: o.ok ? '抓取的可见文本（节选）' : '该链接未返回可读正文',
    description: o.ok
      ? o.excerpt.slice(0, 920) + (o.excerpt.length > 920 ? '…' : '')
      : '对方可能要求登录、反爬或页面以脚本渲染，服务器仅保存了你的链接；可改用文字多写几句自述。',
  }));

  for (const t of userTexts) {
    if (!t.trim()) continue;
    blocks.push({
      source: '你的文字',
      icon: '✍️',
      tags: ['自述'],
      title: '你写下的片段',
      description: t.trim().slice(0, 900) + (t.length > 900 ? '…' : ''),
    });
  }

  if (screenshotCount > 0) {
    blocks.push({
      source: '你上传的截图·视觉线索',
      icon: '📷',
      tags: ['手传图', '视觉'],
      title: '你提供的画面',
      description: `你在建档时上传了 ${screenshotCount} 张图片（已存档）。当前未调用多模态模型时，仅作占位；可在上方各平台与自述中对照气质描述。`,
    });
  }

  const mbti = '待模型';
  const title = '基于公开摘录与自述的初稿';
  const overall =
    '以上内容来自程序尝试访问你提供的公开链接后的文本摘录，以及你在应用内填写的文字；并非官方平台背书。设置 OPENAI_API_KEY 后可将全部材料交给大模型生成更连贯的灵魂档案。';
  const base: SoulReport = {
    mbti,
    title,
    avatarTags: ['多源线索', '线上人格'],
    blocks,
    overall,
  };
  return { ...base, article: stubArticleFromLegacy(base) };
}

/**
 * 模型可能仍漏平台：按抓取结果逐项检查，缺则补上一条（避免用户绑了 5 个却只看见 3 块）。
 */
export function ensureBlocksCoverAllScrapes(
  report: SoulReport,
  scrapes: ScrapeOutcome[],
): SoulReport {
  if (!scrapes.length) return report;
  const blocks = [...report.blocks];
  for (const o of scrapes) {
    const label = scrapeOutcomeToDisplayName(o);
    const hit = blocks.some(
      (b) =>
        b.source.includes(label) ||
        b.source.includes(o.platform) ||
        (label === '网易云音乐' && b.source.includes('网易')),
    );
    if (hit) continue;
    blocks.push({
      source: `${label}·${o.ok ? '公开线索' : '数据不可用'}`,
      icon: blockIcon(o.platform),
      tags: o.ok ? ['平台摘录'] : ['暂无正文'],
      title: o.ok ? '该平台的可见信息' : '未能读取有效主页正文',
      description: o.ok
        ? (o.excerpt.length > 240 ? `${o.excerpt.slice(0, 240)}…` : o.excerpt)
        : '该链接在当前环境下未返回可读内容（常见原因：登录墙、反爬或纯脚本页）。未新增臆测；你可补充文字自述帮助档案完整。',
    });
  }
  return { ...report, blocks };
}

/** 用户步骤一上传的截图：模型漏写时补一条 */
export function ensureUserHandUploadBlock(report: SoulReport, userUploadCount: number): SoulReport {
  if (userUploadCount <= 0) return report;
  const blocks = [...report.blocks];
  const hit = blocks.some((b) =>
    /你上传的截图|手传|用户上传的截图|建档截图|上传的图片/.test(`${b.source} ${b.title}`),
  );
  if (!hit) {
    blocks.push({
      source: '你上传的截图·视觉线索',
      icon: '📷',
      tags: ['手传图', '视觉'],
      title: '请在上方查看你上传的画面',
      description: `你在本应用建档流程中上传了 ${userUploadCount} 张图片；模型输出未单列解读时已自动保留此条。请结合画面中的界面、文字与氛围理解档案；若已配置视觉模型，解读应已体现在其他条目中。`,
    });
  }
  return { ...report, blocks };
}

/** 单次 OpenAI 调用的通用封装，返回原始 JSON 字符串或 null */
async function callOpenAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: unknown }>,
  maxTokens: number,
  timeoutMs = 90_000,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.78,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
  } catch (e) {
    console.error('[OpenAI] fetch 异常:', e instanceof Error ? e.message : String(e));
    return null;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[OpenAI] HTTP ${res.status}: ${errText.slice(0, 400)}`);
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    error?: { message?: string };
  };

  if (data.error) {
    console.error('[OpenAI] API 错误:', data.error.message);
    return null;
  }

  const choice = data?.choices?.[0];
  const raw = choice?.message?.content ?? null;
  console.log(`[OpenAI] finish_reason=${choice?.finish_reason}, rawLen=${raw?.length ?? 0}`);
  return raw;
}

/**
 * 第二轮：视觉增强调用。
 * 传入所有截图（每批最多 4 张），让模型输出每张截图对应的平台 key 与 description 补充。
 * 返回 Map<平台key, 视觉描述文字> 或 null（失败时跳过，不影响主报告）。
 */
async function callVisionEnhancement(
  apiKey: string,
  baseUrl: string,
  model: string,
  platformKeys: string[],
  screenshotDataUrls: string[],
): Promise<Map<string, string> | null> {
  if (screenshotDataUrls.length === 0) return null;

  // 每批 2 张 + high detail：确保能读取中文截图里的小字
  const BATCH = 2;
  const allDescriptions = new Map<string, string>();

  for (let start = 0; start < screenshotDataUrls.length; start += BATCH) {
    const batchUrls = screenshotDataUrls.slice(start, start + BATCH);
    const batchKeys = platformKeys.slice(start, start + BATCH);

    const imageMessages = batchUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url, detail: 'high' as const },  // high 保证能读出中文文字、数字
    }));

    // 构建 key→index 映射，以便模型按顺序对应
    const keyList = batchKeys.map((k, i) => `图${i + 1}=${k}`).join('，');
    const prompt =
      `以下 ${batchKeys.length} 张截图对应平台（${keyList}）。\n` +
      `请仔细阅读每张图中的所有可见文字（包括昵称、签名、粉丝数、关注数、帖子/回答标题片段、个人简介等），` +
      `输出严格 JSON，格式：{${batchKeys.map((k) => `"${k}":"描述"`).join(',')}}\n` +
      `每条描述 200～350 字：① 直接引用截图中可见的原文（昵称、数字、标题关键词）；` +
      `② 描述内容风格与版式气质；③ 若截图是验证码/空白/404，则写"页面为验证码或无效页面"。` +
      `禁止推测截图中看不到的信息。`;

    const messages = [
      { role: 'user', content: [{ type: 'text', text: prompt }, ...imageMessages] },
    ];

    console.log(`[OpenAI-Vision] 批次 ${Math.floor(start / BATCH) + 1}，平台: ${batchKeys.join(',')}`);
    const raw = await callOpenAI(apiKey, baseUrl, model, messages, 4000, 60_000);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.length > 20) allDescriptions.set(k, v);
      }
    } catch (e) {
      console.error('[OpenAI-Vision] JSON 解析失败:', e instanceof Error ? e.message : String(e));
    }
  }

  return allDescriptions.size > 0 ? allDescriptions : null;
}

export async function tryOpenAISoulReport(
  context: string,
  screenshotDataUrls: string[] = [],
  /** 平台 key 列表，与 screenshotDataUrls 顺序对应（platformShotKeys[i] ↔ screenshotDataUrls[i]） */
  platformShotKeys: string[] = [],
): Promise<SoulReport | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');

  const depthHint = [
    '\n\n【本次生成 · 深度与文风双重硬性检查清单（逐项自核后输出）】\n',
    '\n─ 结构指标 ─\n',
    '① corePersonality pillars ≥2 个，每柱 bullets ≥2 条，每条 ≥80 字并含可核验细节（平台名/昵称/数字）；\n',
    '② hobbies fixedGroups 两组合计 ≥6 条长句 bullet，禁止单词或短语；\n',
    '③ speakingStyle detailBullets ≥4 条，每条 ≥50 字，须注明材料来源平台；\n',
    '④ values dimensions 4 维各 ≥60 字，与材料行为挂钩；\n',
    '⑤ 每位名人 evidence ≥120 字，必须写清「与用户材料的具体同构点」；\n',
    '⑥ timeline ≥8 个时段，每段 paragraph ≥3 句完整中文，含具体时间/习惯/情绪/场景；\n',
    '⑦ overall 200～450 汉字。\n',
    '\n─ 文风指标（与「全网人格精准解码」特稿对齐）─\n',
    '⑧ 禁止使用「善于社交、热爱生活、积极向上、情感细腻、富有创意」等万能套语；每个判断须对应材料中的昵称/数字/具体帖子/可见行为；\n',
    '⑨ 每条 bullet 须有「材料支撑句」+ 「人格解读句」双层结构，例如：「你在小红书开帖用自己的邮箱替陌生人答疑（材料）→ 这是把「帮到别人」当成价值感来源的典型 ISFJ 底色（解读）」；\n',
    '⑩ 整体语气接近非虚构特稿：有冲击力、有画面感、允许口语化短句，但绝不脱离材料脑补；\n',
    '⑪ 若某平台材料极少，诚实说明「该平台仅有昵称/签名，无法深挖」，不以万能话填充。\n',
    '\n以上任一不达标须在同一回复中补足，不得缩减。',
  ].join('');

  const textBody = `${context.slice(0, 20000)}${depthHint}`;

  // ── 第一轮：纯文字调用，生成完整报告结构 ──────────────────────────────────
  console.log(`[OpenAI] 第一轮（文字分析）model=${model}，contextLen=${textBody.length}`);
  const round1Messages = [
    { role: 'system', content: getSoulReportSystemPrompt() },
    { role: 'user', content: textBody },
  ];
  const raw1 = await callOpenAI(apiKey, baseUrl, model, round1Messages, 14000, 90_000);
  if (!raw1) return null;

  let report: SoulReport;
  try {
    const parsed = JSON.parse(raw1) as SoulReport;
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
      console.error('[OpenAI] 第一轮响应缺少 blocks 字段');
      return null;
    }
    report = parsed;
  } catch (e) {
    console.error('[OpenAI] 第一轮 JSON 解析失败:', e instanceof Error ? e.message : String(e), raw1.slice(0, 200));
    return null;
  }

  // ── 第二轮：视觉增强（如有截图，全部传入，分批 low-detail 处理）──────────
  if (screenshotDataUrls.length > 0) {
    const keys = platformShotKeys.length === screenshotDataUrls.length
      ? platformShotKeys
      : screenshotDataUrls.map((_, i) => `platform_${i}`);

    console.log(`[OpenAI] 第二轮（视觉增强），共 ${screenshotDataUrls.length} 张截图`);
    const visionMap = await callVisionEnhancement(apiKey, baseUrl, model, keys, screenshotDataUrls);

    if (visionMap && visionMap.size > 0) {
      // 用视觉描述替换第一轮生成的 block description（视觉信息优先，更可靠）
      report = {
        ...report,
        blocks: report.blocks.map((block) => {
          for (const [key, vDesc] of visionMap.entries()) {
            if (block.source.toLowerCase().includes(key.toLowerCase())) {
              // 若视觉描述明确指出是验证码/无效页面，保留原 description
              if (/验证码|无效页面|404|空白/.test(vDesc)) {
                return block;
              }
              return {
                ...block,
                description: vDesc,   // 直接用视觉解读替换，更基于真实可见内容
              };
            }
          }
          return block;
        }),
      };
      console.log(`[OpenAI] 视觉增强完成，命中平台: ${[...visionMap.keys()].join(', ')}`);
    }
  }

  if (!isCompleteSoulReportArticle(report.article)) {
    return { ...report, article: stubArticleFromLegacy(report) };
  }
  return report;
}
