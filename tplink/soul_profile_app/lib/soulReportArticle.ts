/**
 * 与「全网人格全维度精准解码」长文模板对齐的结构化正文（由模型 JSON 输出 + 可选兜底生成）。
 */

export type ArticlePillar = {
  label: string;
  bullets: string[];
};

export type SoulReportArticle = {
  headline: string;
  guaranteeIntro: string;
  section1: {
    sectionTitle: string;
    corePersonality: {
      heading: string;
      pillars: ArticlePillar[];
    };
    hobbies: {
      heading: string;
      fixedGroups: Array<{ groupTitle: string; bullets: string[] }>;
      casualBullets: string[];
    };
    speakingStyle: {
      heading: string;
      evidenceNote?: string;
      coreTone: string;
      detailBullets: string[];
    };
    values: {
      heading: string;
      dimensions: Array<{ label: string; content: string }>;
    };
  };
  section2: {
    sectionTitle: string;
    celebrities: Array<{
      order: number;
      name: string;
      angle: string;
      evidence: string;
    }>;
    bestPick: { name: string; summary: string };
  };
  section3: {
    sectionTitle: string;
    personaName: string;
    personaCore: string;
    timeline: Array<{ clock: string; paragraph: string }>;
  };
};

function nonEmpty(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

/** 浅层校验：缺字段或与 prompt 约定不符时返回 false，由调用方用 stub 兜底 */
export function isCompleteSoulReportArticle(a: unknown): a is SoulReportArticle {
  if (!a || typeof a !== 'object') return false;
  const x = a as SoulReportArticle;
  if (!nonEmpty(x.headline) || !nonEmpty(x.guaranteeIntro)) return false;
  if (!x.section1?.corePersonality?.pillars?.length) return false;
  if (!Array.isArray(x.section2?.celebrities) || x.section2.celebrities.length !== 3) return false;
  if (!Array.isArray(x.section3?.timeline) || x.section3.timeline.length < 8) return false;
  if (!nonEmpty(x.section2.bestPick?.name) || !nonEmpty(x.section2.bestPick?.summary)) return false;
  return true;
}

export function stubArticleFromLegacy(params: {
  mbti: string;
  title: string;
  overall: string;
  avatarTags: string[];
  blocks: { source: string; title: string; description: string }[];
}): SoulReportArticle {
  const { mbti, title, overall, blocks } = params;
  const blockBullets = blocks.slice(0, 6).map(
    (b) => `【${b.source}】${b.title}：${b.description.slice(0, 160)}${b.description.length > 160 ? '…' : ''}`,
  );
  return {
    headline: `你的全网人格全维度解码（材料来自你绑定的公开主页与自述）`,
    guaranteeIntro:
      '本段为离线/兜底生成：未调用大模型或模型未返回长文结构时，仅将已有摘录与分块结论整理成可读长文。配置 OPENAI_API_KEY 后可获得与线上一致的深度解码。',
    section1: {
      sectionTitle: '一、全维度细节拆解：人格、爱好、表达与价值取向',
      corePersonality: {
        heading: `（一）核心人格：${title || '待补充'} · ${mbti || '-'}`,
        pillars: [
          {
            label: '材料摘要（来自各平台摘录）',
            bullets: blockBullets.length ? blockBullets : ['暂无足够正文，请补充链接或自述。'],
          },
        ],
      },
      hobbies: {
        heading: '（二）兴趣爱好：基于可见主页线索',
        fixedGroups: [
          {
            groupTitle: '从材料中可见的线索',
            bullets: blockBullets.length ? blockBullets : ['—'],
          },
        ],
        casualBullets: ['更多细节见上方各平台分块与自述。'],
      },
      speakingStyle: {
        heading: '（三）说话风格',
        evidenceNote: '以下为摘录拼接，非模型推断。',
        coreTone: '以你提供的公开文本为主；材料不足处未作臆测。',
        detailBullets: blocks
          .filter((b) => b.description.length > 20)
          .slice(0, 4)
          .map((b) => `${b.source}：${b.description.slice(0, 200)}${b.description.length > 200 ? '…' : ''}`),
      },
      values: {
        heading: '（四）三观内核',
        dimensions: [
          { label: '综合', content: overall.slice(0, 800) + (overall.length > 800 ? '…' : '') },
        ],
      },
    },
    section2: {
      sectionTitle: '二、与你气质相近的参考人物（材料不足时为占位）',
      celebrities: [
        {
          order: 1,
          name: '（待模型生成）',
          angle: '公开材料较少时不强行匹配名人',
          evidence: '请完成一次完整在线分析以生成贴合实锤的名人参照。',
        },
        {
          order: 2,
          name: '（待模型生成）',
          angle: '同上',
          evidence: '同上。',
        },
        {
          order: 3,
          name: '（待模型生成）',
          angle: '同上',
          evidence: '同上。',
        },
      ],
      bestPick: { name: '—', summary: '同上。' },
    },
    section3: {
      sectionTitle: '三、AI 分身的一天（占位）',
      personaName: '数字分身',
      personaCore: '基于你的主页气质虚构一日节奏；兜底模式下仅为示意。',
      timeline: [
        { clock: '07:30', paragraph: '自然醒，浏览各平台已存档的公开线索。' },
        { clock: '09:00', paragraph: '整理摘录与分块，形成档案叙事。' },
        { clock: '12:00', paragraph: '午休；材料越多，解读越稳。' },
        { clock: '14:00', paragraph: '对照截图与手传图补全视觉气质。' },
        { clock: '16:00', paragraph: '回顾自述中的措辞与价值观表述。' },
        { clock: '18:00', paragraph: '收束跨平台差异与边界感。' },
        { clock: '21:00', paragraph: '轻量复盘：哪些结论有原文支撑。' },
        { clock: '22:30', paragraph: '结束；建议补充链接与自述以提升实锤密度。' },
      ],
    },
  };
}
