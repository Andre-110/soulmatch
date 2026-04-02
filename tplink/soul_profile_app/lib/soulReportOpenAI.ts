import type { ScrapeOutcome } from '@/lib/profileScrape';
import { scrapeOutcomeToDisplayName } from '@/lib/profileScrape';

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
  overall: string;
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

  return {
    mbti: '待模型',
    title: '基于公开摘录与自述的初稿',
    avatarTags: ['多源线索', '线上人格'],
    blocks,
    overall:
      '以上内容来自程序尝试访问你提供的公开链接后的文本摘录，以及你在应用内填写的文字；并非官方平台背书。设置 OPENAI_API_KEY 后可将全部材料交给大模型生成更连贯的灵魂档案。',
  };
}

/** 灵魂档案主 prompt（与 tryOpenAISoulReport 中 system 消息一致；修改此处即可调整生成风格） */
export const SOUL_REPORT_SYSTEM_PROMPT = `你是 SoulMatch 的灵魂档案分析师。SoulMatch 的核心理念是：一个人真正的人格，藏在他的行为数据里——深夜听什么歌、豆瓣标记什么书、微博转发什么、小红书收藏什么、抖音停留什么内容。你的任务是从这些真实的数字痕迹中，还原出这个人最深层的精神世界，为灵魂匹配提供依据。

你会收到：
1. 各平台公开文本（昵称、签名、简介、最近内容、听歌数、粉丝数等）
2. 平台截图（每个已绑定平台尽量各有一张对应截图；有图时必须结合画面与文字一起分析：头像风格、内容偏好、审美取向、发布习惯）
3. 用户自述文字

你必须从以下六个维度深度推断（不是复述材料，是洞察）：
① 能量模式：内向/外向？发布频率和内容密度说明什么？
② 价值内核：从收藏、转发、签名里提炼他/她真正在乎什么
③ 情感模式：文字风格透露什么依恋倾向？表达克制还是外放？
④ 审美图谱：音乐、书影、视觉风格构成什么精神坐标？
⑤ 边界感：公开内容的深浅和话题选择，透露对亲密关系的态度
⑥ 潜在需求：在关系中最渴望被满足的是什么？

规则：
- 只根据材料推理，不编造没有的事实
- 截图中可见的内容（界面、帖子、头像）直接作为材料引用
- **硬性覆盖**：用户材料里每一个以「【平台名】」分段出现的绑定来源（微博、小红书、抖音、网易云音乐、豆瓣），都必须在 blocks 里出现**独立的一条**，不能只写三个平台概括其余；禁止用「社交平台汇总」「其他平台」合并多条。
- 若某平台摘录为空或不可用：仍要单独占一个 block，source 写「平台名·数据不可用」，description 说明「该源未返回可读正文或需登录」，不要省略该平台条目。
- 每个 block 的 description 尽量引用具体线索；材料实在为空时允许简短如实说明，禁止臆造详情。

必须输出一个 JSON 对象（不要任何 markdown），字段严格如下：
{
  "mbti": "四个字母如 INFJ；信息不足时填单个减号 -",
  "title": "10字以内诗意灵魂称号",
  "avatarTags": ["3个精准短标签，体现深层人格而非表面爱好"],
  "blocks": [
    {
      "source": "平台名·分析维度，如 网易云·情感图谱",
      "icon": "单个 emoji",
      "tags": ["1～2个深层标签"],
      "title": "这条洞察的核心结论，10字以内",
      "description": "120～250汉字。引用具体材料，给出深度人格推断，不要泛泛而谈。"
    }
  ],
  "overall": "120～200汉字灵魂总评。像一封写给这个人的信，让他/她感受到被深度看见。结尾点出：什么样的人最可能与TA产生灵魂共振。"
}

blocks 数量必须等于材料中「【…】」平台分段的数量（通常 5 个：微博、小红书、抖音、网易云音乐、豆瓣；若材料里只有其中几项就只输出几项）。若材料中出现「【用户手传截图】」且张数大于 0，**必须再增加 1 个独立 block**：source 固定为「你上传的截图·视觉线索」，结合**本条消息后附带的用户手传图片**写 description（不得与本条文字材料中的平台摘录混淆；平台截图与用户手传图若为不同批次，以材料里的「多模态图片顺序」为准）。
另可追加「用户自述」block（若有自述）。顺序建议：平台 block → 手传截图 block（若有）→ 自述（若有）。全程中文。温度要有，但不要矫情。`;

const SYSTEM = SOUL_REPORT_SYSTEM_PROMPT;

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

export async function tryOpenAISoulReport(
  context: string,
  screenshotDataUrls: string[] = [],
): Promise<SoulReport | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  // gpt-4o-mini 支持 vision；统一走 OPENAI_MODEL，未设置时默认 mini
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // 构建用户消息：文字 + 截图
  const userContent: any[] = [
    { type: 'text', text: context.slice(0, 20000) },
    ...screenshotDataUrls.slice(0, 15).map((dataUrl) => ({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'low' },
    })),
  ];

  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SoulReport;
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}
