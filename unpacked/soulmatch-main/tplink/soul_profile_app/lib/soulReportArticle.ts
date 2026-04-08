/**
 * 与「全网人格全维度精准解码」长文模板对齐的结构化正文（由模型 JSON 输出 + 可选兜底生成）。
 * 当前支持新结构（section2/3/4）与历史结构（section1/2/3）的兼容判定。
 */

export type SoulReportDayPartSlot = '晨起' | '独处' | '午餐' | '工作' | '玩耍' | '阅读';

export type SoulReportArticle = {
  headline: string;
  guaranteeIntro: string;
  section2: {
    sectionTitle: string;
    celebrities: Array<{
      order: number;
      name: string;
      similarityScore: number;
      recommendReason: string;
      // 兼容历史字段
      angle?: string;
      evidence?: string;
    }>;
  };
  section3: {
    sectionTitle: string;
    fourHumorTheory: { type: string; note: string };
    lovePersona16: { type: string; note: string };
    animalPersona: { type: string; note: string };
    todayFortune: { love: string; career: string; wealth: string };
    fiveFactorPersona: { type: string; note: string };
    fruitPersona: { type: string; note: string };
    drinkPersona: { type: string; note: string };
  };
  section4: {
    sectionTitle: string;
    personaName: string;
    personaCore: string;
    dayParts: Array<{
      order: number;
      slot: SoulReportDayPartSlot;
      clock: string;
      paragraph: string;
      sourceTag: string;
      detailTags: string[];
    }>;
  };
  // 兼容历史结构残留字段（可选）
  section1?: unknown;
};

function nonEmpty(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function isLegacyArticleShape(a: unknown): boolean {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  const section1 = x.section1 as Record<string, unknown> | undefined;
  const section2 = x.section2 as Record<string, unknown> | undefined;
  const section3 = x.section3 as Record<string, unknown> | undefined;
  const celebrities = section2?.celebrities as Array<Record<string, unknown>> | undefined;
  const timeline = section3?.timeline as Array<Record<string, unknown>> | undefined;
  return Boolean(
    section1?.corePersonality &&
      Array.isArray(celebrities) &&
      celebrities.length === 3 &&
      Array.isArray(timeline) &&
      timeline.length >= 8,
  );
}

/** 浅层校验：缺字段或与 prompt 约定不符时返回 false，由调用方用 stub 兜底 */
export function isCompleteSoulReportArticle(a: unknown): a is SoulReportArticle {
  if (!a || typeof a !== 'object') return false;
  if (isLegacyArticleShape(a)) return true;

  const x = a as SoulReportArticle;
  if (!nonEmpty(x.headline) || !nonEmpty(x.guaranteeIntro)) return false;
  if (!nonEmpty(x.section2?.sectionTitle)) return false;
  if (!Array.isArray(x.section2?.celebrities) || x.section2.celebrities.length !== 3) return false;
  const badCelebrities = x.section2.celebrities.some((c) => {
    if (!nonEmpty(c.name)) return true;
    if (!Number.isFinite(c.similarityScore) || c.similarityScore < 1 || c.similarityScore > 10) return true;
    return !nonEmpty(c.recommendReason) || c.recommendReason.trim().length > 10;
  });
  if (badCelebrities) return false;

  if (!nonEmpty(x.section3?.sectionTitle)) return false;
  if (!nonEmpty(x.section3?.fourHumorTheory?.type) || !nonEmpty(x.section3?.fourHumorTheory?.note)) return false;
  if (!nonEmpty(x.section3?.lovePersona16?.type) || !nonEmpty(x.section3?.lovePersona16?.note)) return false;
  if (!nonEmpty(x.section3?.animalPersona?.type) || !nonEmpty(x.section3?.animalPersona?.note)) return false;
  if (!nonEmpty(x.section3?.todayFortune?.love) || !nonEmpty(x.section3?.todayFortune?.career) || !nonEmpty(x.section3?.todayFortune?.wealth)) return false;
  if (!nonEmpty(x.section3?.fiveFactorPersona?.type) || !nonEmpty(x.section3?.fiveFactorPersona?.note)) return false;
  if (!nonEmpty(x.section3?.fruitPersona?.type) || !nonEmpty(x.section3?.fruitPersona?.note)) return false;
  if (!nonEmpty(x.section3?.drinkPersona?.type) || !nonEmpty(x.section3?.drinkPersona?.note)) return false;

  if (!nonEmpty(x.section4?.sectionTitle) || !nonEmpty(x.section4?.personaName) || !nonEmpty(x.section4?.personaCore)) return false;
  if (!Array.isArray(x.section4?.dayParts) || x.section4.dayParts.length !== 6) return false;
  const requiredSlots: SoulReportDayPartSlot[] = ['晨起', '独处', '午餐', '工作', '玩耍', '阅读'];
  const slots = x.section4.dayParts.map((d) => d.slot);
  for (const slot of requiredSlots) {
    if (!slots.includes(slot)) return false;
  }
  const badDayParts = x.section4.dayParts.some((d) => {
    if (!nonEmpty(d.clock) || !nonEmpty(d.paragraph) || !nonEmpty(d.sourceTag)) return true;
    return !Array.isArray(d.detailTags);
  });
  if (badDayParts) return false;

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
  const topTags = params.avatarTags.slice(0, 3);
  const musicHint = blocks.find((b) => /网易云|音乐/.test(`${b.source}${b.title}${b.description}`));
  const foodHint = blocks.find((b) => /吃|美食|餐|午饭|晚饭/.test(`${b.source}${b.title}${b.description}`));
  const travelHint = blocks.find((b) => /旅行|旅游|城市|景点|海|山|湖/.test(`${b.source}${b.title}${b.description}`));
  const readHint = blocks.find((b) => /阅读|书|知乎|豆瓣/.test(`${b.source}${b.title}${b.description}`));

  const pickSnippet = (s?: string, len = 36) => {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    return t.length > len ? `${t.slice(0, len)}…` : t || '待补充';
  };

  return {
    headline: `你的灵魂档案已生成（基于公开素材与手传线索）`,
    guaranteeIntro:
      '当前为兜底结构化结果：已优先整理你提供的公开材料与截图线索，保持可回查，不做无依据扩写。',
    section2: {
      sectionTitle: '二、和你灵魂高度契合的3位名人',
      celebrities: [
        { order: 1, name: '（待模型生成）', similarityScore: 8, recommendReason: '同频感很强' },
        { order: 2, name: '（待模型生成）', similarityScore: 7, recommendReason: '气质很接近' },
        { order: 3, name: '（待模型生成）', similarityScore: 7, recommendReason: '相处会轻松' },
      ],
    },
    section3: {
      sectionTitle: '三、多维人格测试',
      fourHumorTheory: { type: '多血质', note: '热闹感在线' },
      lovePersona16: { type: `${mbti || 'INFP'}恋爱型`, note: '偏感受驱动' },
      animalPersona: { type: '海豚型', note: '温柔有默契' },
      todayFortune: { love: '有小惊喜', career: '灵感回暖', wealth: '稳中有进' },
      fiveFactorPersona: { type: '和平型', note: '不爱内耗' },
      fruitPersona: { type: '水蜜桃型', note: '甜而不腻' },
      drinkPersona: { type: '冰美式型', note: '清醒松弛' },
    },
    section4: {
      sectionTitle: '四、你的AI分身的一天',
      personaName: title || '数字分身',
      personaCore: `基于你公开主页与截图线索，生成轻松但不失真、带具体来源标签的一天叙事。`,
      dayParts: [
        {
          order: 1,
          slot: '晨起',
          clock: '08:00',
          paragraph: `起床先放歌让自己进入状态，今天默认循环 ${pickSnippet(musicHint?.title, 16)} 这一挂的旋律，先把情绪调到舒服档。`,
          sourceTag: '#网易云音乐#',
          detailTags: ['#歌曲偏好#'],
        },
        {
          order: 2,
          slot: '独处',
          clock: '10:00',
          paragraph: `独处时间会做自己熟悉的小爱好，节奏偏慢但专注，属于“人少但心里很满”的状态。`,
          sourceTag: `#${pickSnippet(travelHint?.source || readHint?.source, 10)}#`,
          detailTags: topTags.length ? topTags.map((t) => `#${t}#`) : ['#独处偏好#'],
        },
        {
          order: 3,
          slot: '午餐',
          clock: '12:30',
          paragraph: `午餐会优先选自己常点或常拍的食物，今天想吃的是 ${pickSnippet(foodHint?.title, 14)} 这一类“吃完心情回正”的组合。`,
          sourceTag: '#你的生活照片#',
          detailTags: ['#饮食偏好#'],
        },
        {
          order: 4,
          slot: '工作',
          clock: '14:00',
          paragraph: `工作段主打把零碎灵感收束成可执行动作，先处理关键事项，再补细节，避免情绪化切换任务。`,
          sourceTag: `#${pickSnippet(blocks[0]?.source, 12)}#`,
          detailTags: ['#工作节奏#'],
        },
        {
          order: 5,
          slot: '玩耍',
          clock: '18:00',
          paragraph: `玩耍时偏好能补能量的活动，像短途逛逛、轻社交或沉浸兴趣内容，不追求满行程但追求松弛感。`,
          sourceTag: `#${pickSnippet(travelHint?.source || blocks[1]?.source, 12)}#`,
          detailTags: ['#玩耍偏好#'],
        },
        {
          order: 6,
          slot: '阅读',
          clock: '21:30',
          paragraph: `阅读时会回到自己熟悉的主题，今天读到 ${pickSnippet(readHint?.title, 16)} 附近的内容，慢慢把一天收尾。`,
          sourceTag: `#${pickSnippet(readHint?.source || '你的文字', 12)}#`,
          detailTags: ['#阅读内容#'],
        },
      ],
    },
  };
}
