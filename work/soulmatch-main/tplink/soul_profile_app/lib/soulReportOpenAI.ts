import type { ScrapeOutcome } from '@/lib/profileScrape';
import { scrapeOutcomeToDisplayName } from '@/lib/profileScrape';
import type { SoulReportArticle } from '@/lib/soulReportArticle';
import { isCompleteSoulReportArticle } from '@/lib/soulReportArticle';
import { getSoulReportSystemPrompt } from '@/lib/soulReportPrompt';

export type SoulReport = {
  mbti: string;
  mbtiDimensions?: Array<{
    code: string;
    label: string;
    score?: number;
    note?: string;
  }>;
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

/** vision 批次里的 key 为平台英文 key（如 xhs），block.source 多为「小红书·…」— 需双向匹配 */
const VISION_KEY_TO_LABEL: Record<string, string> = {
  xhs: '小红书',
  weibo: '微博',
  douyin: '抖音',
  netease: '网易云',
  douban: '豆瓣',
  zhihu: '知乎',
};

function visionKeyMatchesBlock(key: string, blockSource: string): boolean {
  const k = key.toLowerCase();
  if (blockSource.toLowerCase().includes(k)) return true;
  const label = VISION_KEY_TO_LABEL[k];
  return label ? blockSource.includes(label) : false;
}

function isUserUploadVisionKey(key: string): boolean {
  return /^user_upload_\d+$/i.test(key);
}

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
  return base;
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

/** 模型仍可能把某平台写成「抓取失败」等，但抓取 excerpt 实际有正文：用摘录覆盖对应 block（尤其小红书）。 */
const SCRAPE_FAILURE_IN_DESCRIPTION =
  /未连接|抓取失败|数据不可用|无法获取|无法连接|服务器|页面未连接|未能获取有效|当前环境下未返回/i;

function blockMatchesScrape(
  b: SoulReport['blocks'][number],
  o: ScrapeOutcome,
  label: string,
): boolean {
  return (
    b.source.includes(label) ||
    b.source.includes(o.platform) ||
    (o.platform === 'netease' && b.source.includes('网易'))
  );
}

export function applyScrapeEvidenceToBlocks(report: SoulReport, scrapes: ScrapeOutcome[]): SoulReport {
  if (!scrapes.length) return report;
  const blocks = report.blocks.map((b) => {
    for (const o of scrapes) {
      if (!o.ok) continue;
      const excerpt = (o.excerpt || '').trim();
      if (excerpt.length < 40) continue;
      const label = scrapeOutcomeToDisplayName(o);
      if (!blockMatchesScrape(b, o, label)) continue;
      const forceFromScrape =
        o.platform === 'xhs' || SCRAPE_FAILURE_IN_DESCRIPTION.test(b.description);
      if (!forceFromScrape) continue;
      return {
        ...b,
        source: `${label}·公开页摘录`,
        title: o.platform === 'xhs' ? '抓取的可见文本（节选）' : b.title,
        description: excerpt.length > 2000 ? `${excerpt.slice(0, 2000)}…` : excerpt,
        tags: b.tags?.length ? b.tags : ['平台摘录'],
      };
    }
    return b;
  });
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
  temperature = 0.65,
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
        temperature,
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

function hasEvidenceSignal(text: string): boolean {
  const t = text || '';
  return (
    /[0-9]{2,}/.test(t) ||
    /昵称|简介|粉丝|关注|点赞|评论|歌单|回答|动态|截图|自述|发布|收藏/.test(t) ||
    /「|」|【|】|“|”/.test(t)
  );
}

function isLikelyGenericText(text: string): boolean {
  return /善于社交|热爱生活|积极向上|情感细腻|富有创意|开朗乐观|阳光正能量/.test(text || '');
}

function collectReportTexts(report: SoulReport): string[] {
  const texts: string[] = [
    report.mbti || '',
    report.title || '',
    report.overall || '',
  ];
  for (const block of report.blocks || []) {
    texts.push(block.source || '', block.title || '', block.description || '', ...(block.tags || []));
  }
  const article = report.article;
  if (article) {
    texts.push(article.headline || '', article.guaranteeIntro || '');
    for (const celeb of article.section2?.celebrities || []) {
      texts.push(celeb.name || '', celeb.recommendReason || '');
    }
    const section3 = article.section3;
    if (section3) {
      texts.push(
        section3.fourHumorTheory?.type || '',
        section3.fourHumorTheory?.note || '',
        section3.lovePersona16?.type || '',
        section3.lovePersona16?.note || '',
        section3.animalPersona?.type || '',
        section3.animalPersona?.note || '',
        section3.todayFortune?.love || '',
        section3.todayFortune?.career || '',
        section3.todayFortune?.wealth || '',
        section3.fiveFactorPersona?.type || '',
        section3.fiveFactorPersona?.note || '',
        section3.fruitPersona?.type || '',
        section3.fruitPersona?.note || '',
        section3.drinkPersona?.type || '',
        section3.drinkPersona?.note || '',
      );
    }
    const section4 = article.section4;
    if (section4) {
      texts.push(section4.personaName || '', section4.personaCore || '');
      texts.push(section4.finalCard?.intro || '', section4.finalCard?.closingLine || '', ...(section4.finalCard?.summaryLines || []));
      for (const part of section4.dayParts || []) {
        texts.push(part.clock || '', part.slot || '', part.paragraph || '', part.sourceTag || '', ...(part.detailTags || []));
      }
    }
  }
  return texts.filter(Boolean);
}

function findUnsupportedClaims(params: {
  report: SoulReport;
  evidenceText: string;
  screenshotCount: number;
}): string[] {
  const { report, evidenceText, screenshotCount } = params;
  const reasons: string[] = [];
  const reportText = collectReportTexts(report).join('\n');
  const normalizedEvidence = evidenceText.replace(/\s+/g, ' ');

  if (screenshotCount === 0 && /你的生活照片|你上传的截图|手传图|生活照片/.test(reportText)) {
    reasons.push('输出引用了不存在的用户截图/生活照片');
  }

  const songRefs = [...reportText.matchAll(/《([^》]{1,40})》/g)].map((m) => m[1]).filter(Boolean);
  if (songRefs.length > 0) {
    const unsupportedSong = songRefs.find((song) => !normalizedEvidence.includes(song));
    if (unsupportedSong) reasons.push(`输出出现无依据歌名：${unsupportedSong}`);
  }

  return reasons;
}

function assessReportQuality(
  report: SoulReport,
  scrapes: ScrapeOutcome[],
  extra?: { evidenceText?: string; screenshotCount?: number },
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const blocks = Array.isArray(report.blocks) ? report.blocks : [];
  const overall = String(report.overall ?? '');

  if (!report.mbti || String(report.mbti).trim().length < 4) {
    reasons.push('mbti 字段缺失或过短');
  }
  if (overall.replace(/\s+/g, '').length < 160) {
    reasons.push('overall 过短');
  }
  if (isLikelyGenericText(overall)) {
    reasons.push('overall 存在空泛套语');
  }
  if (blocks.length < Math.max(3, scrapes.length)) {
    reasons.push('blocks 条数偏少，平台覆盖不足');
  }

  const evidenceBlocks = blocks.filter((b) => hasEvidenceSignal(String(b.description ?? '')));
  if (blocks.length > 0 && evidenceBlocks.length / blocks.length < 0.6) {
    reasons.push('blocks 证据密度偏低');
  }

  for (const s of scrapes) {
    const label = scrapeOutcomeToDisplayName(s);
    const hit = blocks.some((b) => `${b.source} ${b.title}`.includes(label));
    if (!hit) reasons.push(`缺少平台段落：${label}`);
  }

  const article = report.article;
  if (!isCompleteSoulReportArticle(article)) {
    reasons.push('article 结构不完整');
  } else {
    const badCelebrity = article.section2.celebrities.find(
      (c) =>
        !Number.isFinite(c.similarityScore) ||
        c.similarityScore < 1 ||
        c.similarityScore > 10 ||
        (c.recommendReason || '').trim().length > 10,
    );
    if (badCelebrity) reasons.push('section2 评分或推荐原因格式不符');

    const parts = Array.isArray(article.section4?.dayParts) ? article.section4.dayParts : [];
    if (parts.length !== 6) reasons.push('section4 dayParts 数量不为 6');
    const expectedSlots = ['晨起', '独处', '午餐', '工作', '玩耍', '阅读'];
    for (const slot of expectedSlots) {
      if (!parts.some((p) => p.slot === slot)) reasons.push(`section4 缺少时段：${slot}`);
    }
    const weakPart = parts.find(
      (p) =>
        (p.paragraph || '').trim().length < 35 ||
        !String(p.sourceTag || '').includes('#'),
    );
    if (weakPart) reasons.push('section4 场景细节或来源标签不足');
  }

  if (extra?.evidenceText) {
    reasons.push(
      ...findUnsupportedClaims({
        report,
        evidenceText: extra.evidenceText,
        screenshotCount: extra.screenshotCount ?? 0,
      }),
    );
  }

  return { ok: reasons.length === 0, reasons };
}

async function tryRepairLowQualityReport(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  context: string;
  report: SoulReport;
  reasons: string[];
}): Promise<SoulReport | null> {
  const { apiKey, baseUrl, model, context, report, reasons } = params;
  const fixPrompt =
    [
      context.slice(0, 20000),
      '',
      '【你的上一版输出存在质量问题，必须完全重写并修复】',
      `不达标项：${reasons.map((r, i) => `${i + 1}. ${r}`).join('；')}`,
      '硬约束：必须写成高密度“实锤特稿”；每个关键结论都绑定可见细节（平台名、数字、原词、具体行为）；禁止空话套话。',
      '禁止虚构平台内容；若某平台材料薄弱，明确写“材料不足”，但不得用泛词填充。',
      '',
      '【上一版 JSON（仅供你发现问题，不可复读）】',
      JSON.stringify(report).slice(0, 22000),
    ].join('\n');

  const messages = [
    { role: 'system', content: getSoulReportSystemPrompt() },
    { role: 'user', content: fixPrompt },
  ];
  const raw = await callOpenAI(apiKey, baseUrl, model, messages, 14000, 100_000, 0.45);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SoulReport;
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch (e) {
    console.error('[OpenAI] 质量修复 JSON 解析失败:', e instanceof Error ? e.message : String(e));
    return null;
  }
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
  scrapes: ScrapeOutcome[] = [],
  extra?: {
    evidenceText?: string;
    screenshotCount?: number;
  },
): Promise<SoulReport | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');

  const depthHint = [
    '\n\n【本次生成 · 深度与文风双重硬性检查清单（逐项自核后输出）】\n',
    '\n─ 结构指标 ─\n',
    '① section2 恰好 3 位名人，每位 similarityScore 为 1~10 整数；\n',
    '② section2 每位 recommendReason 必须 ≤10 字，简短好懂；\n',
    '③ section3 七项人格测试齐全，每项说明尽量 10 字内；\n',
    '④ section4 必须固定 6 段：晨起/独处/午餐/工作/玩耍/阅读；\n',
    '⑤ section4 每段必须带 sourceTag（#标签#）与 detailTags；\n',
    '⑥ 晨起段必须出现具体歌曲名并带 #网易云音乐# 来源；\n',
    '⑦ overall 220～420 汉字，必须含具体细节与 #标签#。\n',
    '\n─ 文风指标（与「全网人格精准解码」特稿对齐）─\n',
    '⑧ 语气改为 00 后可读的轻松诙谐表达，但必须建立在证据上；\n',
    '⑨ 禁止使用「善于社交、热爱生活、积极向上」等万能套语；\n',
    '⑩ 若某平台材料极少，诚实说明，不得硬编；\n',
    '⑪ 只有当用户手传截图真实存在时，才能写「你的生活照片/你上传的截图」等来源；没有就绝对禁止出现；\n',
    '⑫ 只有当输入材料里真的出现了具体歌名、食物名、地点名、书名，才能原样写出；否则宁可写“材料未显示具体名称”，绝对不能脑补。\n',
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

  const quality = assessReportQuality(report, scrapes, extra);
  if (!quality.ok) {
    console.warn('[OpenAI] 首轮报告质量未达标，尝试自动修复:', quality.reasons.join(' | '));
    const repaired = await tryRepairLowQualityReport({
      apiKey,
      baseUrl,
      model,
      context,
      report,
      reasons: quality.reasons,
    });
    if (repaired) {
      report = repaired;
    }
  }

  // ── 第二轮：视觉增强（如有截图，全部传入，分批 low-detail 处理）──────────
  if (screenshotDataUrls.length > 0) {
    const keys = platformShotKeys.length === screenshotDataUrls.length
      ? platformShotKeys
      : screenshotDataUrls.map((_, i) => `platform_${i}`);

    console.log(`[OpenAI] 第二轮（视觉增强），共 ${screenshotDataUrls.length} 张截图`);
    const visionMap = await callVisionEnhancement(apiKey, baseUrl, model, keys, screenshotDataUrls);

    if (visionMap && visionMap.size > 0) {
      const userUploadVisionDescriptions = [...visionMap.entries()]
        .filter(([key, value]) => isUserUploadVisionKey(key) && typeof value === 'string' && value.length > 20)
        .map(([, value]) => value.trim());

      // 用视觉描述替换第一轮生成的 block description（视觉信息优先，更可靠）
      let nextReport: SoulReport = {
        ...report,
        blocks: report.blocks.map((block) => {
          for (const [key, vDesc] of visionMap.entries()) {
            if (isUserUploadVisionKey(key)) continue;
            if (visionKeyMatchesBlock(key, block.source)) {
              // 验证码 / 404 / 网络错误 / 截图不可用：保留第一轮基于「正文摘录」的 description，避免把好摘录换成「未连接服务器」
              if (
                /验证码|无效页面|404|空白|未连接到|网络连接失败|请检查网络|网络异常|连接失败|无法连接|非有效主页/i.test(
                  vDesc,
                )
              ) {
                return block;
              }
              return {
                ...block,
                description: vDesc,
              };
            }
          }
          return block;
        }),
      };
      if (userUploadVisionDescriptions.length > 0) {
        const mergedUserUploadDescription = userUploadVisionDescriptions
          .slice(0, 3)
          .join('\n\n')
          .slice(0, 2000);
        const hitIndex = nextReport.blocks.findIndex((block) =>
          /你上传的截图|手传图|视觉线索|上传的图片/.test(`${block.source} ${block.title}`),
        );
        if (hitIndex >= 0) {
          nextReport = {
            ...nextReport,
            blocks: nextReport.blocks.map((block, index) =>
              index === hitIndex
                ? {
                    ...block,
                    source: '你上传的截图·视觉线索',
                    title: '你上传的画面里透露出的气质',
                    description: mergedUserUploadDescription,
                    tags: block.tags?.length ? block.tags : ['手传图', '视觉'],
                  }
                : block,
            ),
          };
        } else {
          nextReport = {
            ...nextReport,
            blocks: [
              ...nextReport.blocks,
              {
                source: '你上传的截图·视觉线索',
                icon: '📷',
                tags: ['手传图', '视觉'],
                title: '你上传的画面里透露出的气质',
                description: mergedUserUploadDescription,
              },
            ],
          };
        }
      }
      report = nextReport;
      console.log(`[OpenAI] 视觉增强完成，命中平台: ${[...visionMap.keys()].join(', ')}`);
    }
  }

  if (!isCompleteSoulReportArticle(report.article)) return report;
  return report;
}
