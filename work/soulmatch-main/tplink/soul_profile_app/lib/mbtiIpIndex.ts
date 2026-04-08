/**
 * MBTI → IP 形象索引：从模型输出的 mbti 字符串解析主型，再映射到 public/mbti-ip 下的素材。
 * 所有 16 种 MBTI 类型都有独立的专属形象图。
 */

export const MBTI_16 = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const;

export type MbtiCode = (typeof MBTI_16)[number];
export type MbtiSceneKey = '起床' | '阅读' | '吃饭' | '独处';

/** 映射路径 404 或文件缺失时前端回退用（与 DEFAULT_CODE 一致） */
export const MBTI_IP_IMAGE_FALLBACK = '/mbti-ip/INFJ.png';

/** 十六型各自对应的展示用素材（每个类型都有独立的形象图） */
export const MBTI_IP_IMAGE_SRC: Record<MbtiCode, string> = {
  INTJ: '/mbti-ip/INTJ.png',
  INTP: '/mbti-ip/INTP.png',
  ENTJ: '/mbti-ip/ENTJ.png',
  ENTP: '/mbti-ip/ENTP.png',
  INFJ: '/mbti-ip/INFJ.png',
  INFP: '/mbti-ip/INFP.png',
  ENFJ: '/mbti-ip/ENFJ.png',
  ENFP: '/mbti-ip/ENFP.png',
  ISTJ: '/mbti-ip/ISTJ.png',
  ISFJ: '/mbti-ip/ISFJ.png',
  ESTJ: '/mbti-ip/ESTJ.png',
  ESFJ: '/mbti-ip/ESFJ.png',
  ISTP: '/mbti-ip/ISTP.png',
  ISFP: '/mbti-ip/ISFP.png',
  ESTP: '/mbti-ip/ESTP.png',
  ESFP: '/mbti-ip/ESFP.png',
};

const DEFAULT_CODE: MbtiCode = 'INFJ';

/** 从模型输出中取出主型四字码：支持 "ISFJ×INFP"、混写、前后杂质 */
export function parsePrimaryMbtiCode(raw: string | undefined | null): MbtiCode | null {
  if (!raw || typeof raw !== 'string') return null;
  const u = raw.toUpperCase().replace(/\s+/g, '');
  if (u === '-' || u === '待模型' || u.includes('待')) return null;

  const fused = u.match(/([EI][NS][FT][JP])\s*[×X/／]\s*([EI][NS][FT][JP])/);
  if (fused) {
    const a = fused[1] as MbtiCode;
    const b = fused[2] as MbtiCode;
    if (MBTI_16.includes(a)) return a;
    if (MBTI_16.includes(b)) return b;
  }

  const m = u.match(/[EI][NS][FT][JP]/g);
  if (m) {
    for (const x of m) {
      if (MBTI_16.includes(x as MbtiCode)) return x as MbtiCode;
    }
  }
  return null;
}

export type MbtiIpDisplay = {
  /** 解析得到的主型代号（用于角标/埋点） */
  code: MbtiCode;
  /** Next 静态资源路径 */
  imageSrc: string;
  /** 原始 mbti 字段（便于展示融合型原文） */
  rawLabel: string;
};

const MBTI_SCENE_IMAGE_ALIASES: Record<MbtiSceneKey, string[]> = {
  起床: ['起床'],
  阅读: ['阅读', '看书'],
  吃饭: ['吃饭'],
  独处: ['独处'],
};

export function resolveMbtiIpFromReport(mbtiRaw: string | undefined | null): MbtiIpDisplay {
  const rawLabel = (mbtiRaw ?? '').trim() || '—';
  const code = parsePrimaryMbtiCode(mbtiRaw) ?? DEFAULT_CODE;
  return {
    code,
    imageSrc: MBTI_IP_IMAGE_SRC[code],
    rawLabel,
  };
}

/**
 * 前端展示用：给 `/mbti-ip/*.png` 加版本号，避免浏览器使用旧缓存。
 * uniform=3 → 上一轮 uniform=2 的旧缓存（含可能的错误响应）会被浏览器视为不同资源而重新拉取。
 */
export function publicMbtiAssetUrl(path: string): string {
  const clean = path.split('?')[0];
  return `${clean}?uniform=3`;
}

export function getMbtiSceneAssetPath(code: MbtiCode, scene: MbtiSceneKey): string {
  const variants = MBTI_SCENE_IMAGE_ALIASES[scene];
  const fileName = `${code}_${variants[0]}.png`;
  return `/mbti-scene-assets/${code}/${fileName}`;
}

export function getMbtiSceneAssetCandidates(code: MbtiCode, scene: MbtiSceneKey): string[] {
  return MBTI_SCENE_IMAGE_ALIASES[scene].map(
    (variant) => `/mbti-scene-assets/${code}/${code}_${variant}.png`,
  );
}
