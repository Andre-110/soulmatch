import type { ScrapeOutcome } from '@/lib/profileScrape';
import type { Upload } from '@prisma/client';

/** 单次分析写入 DB 的输入快照（不含 base64 图片体，仅元数据与文本） */
export type SoulReportInputRecord = {
  version: 1;
  /** ISO8601 */
  recordedAt: string;
  uploads: {
    id: string;
    type: string;
    /** 文本类内容；过长时截断 */
    content: string | null;
    url: string | null;
  }[];
  scrapes: {
    platform: string;
    url: string;
    ok: boolean;
    method?: string;
    /** 与送入模型的摘录一致（抓取侧已 clip） */
    excerpt: string;
    hasPlatformScreenshot: boolean;
  }[];
  /** 合并后的自述段落（text + voice-text） */
  userTexts: string[];
  userScreenshotUrls: string[];
  screenshotCount: number;
  /** 实际附在多模态请求里的图片张数（平台截图 + 成功读盘的手传图） */
  visionImageCount: number;
  /** 送入模型的文字 context 字符数 */
  contextCharLength: number;
  /** 报告生成来源 */
  reportSource: 'openai' | 'fallback';
  /** reportSource 为 openai 时的模型名 */
  openaiModel?: string;
};

const MAX_UPLOAD_TEXT = 12000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function buildSoulReportInputRecord(params: {
  uploads: Upload[];
  scrapes: ScrapeOutcome[];
  userTexts: string[];
  userScreenshotUrls: string[];
  screenshotCount: number;
  visionImageCount: number;
  context: string;
  reportSource: 'openai' | 'fallback';
  openaiModel?: string;
}): SoulReportInputRecord {
  const {
    uploads,
    scrapes,
    userTexts,
    userScreenshotUrls,
    screenshotCount,
    visionImageCount,
    context,
    reportSource,
    openaiModel,
  } = params;

  return {
    version: 1,
    recordedAt: new Date().toISOString(),
    uploads: uploads.map((u) => ({
      id: u.id,
      type: u.type,
      content: u.content != null && u.content.length > 0 ? truncate(u.content, MAX_UPLOAD_TEXT) : null,
      url: u.url ?? null,
    })),
    scrapes: scrapes.map((o) => ({
      platform: o.platform,
      url: o.url,
      ok: o.ok,
      method: o.method,
      excerpt: o.excerpt,
      hasPlatformScreenshot: Boolean(o.screenshotDataUrl),
    })),
    userTexts: userTexts.map((t) => truncate(t, MAX_UPLOAD_TEXT)),
    userScreenshotUrls,
    screenshotCount,
    visionImageCount,
    contextCharLength: context.length,
    reportSource,
    openaiModel: reportSource === 'openai' ? openaiModel : undefined,
  };
}

export function stringifyInputRecord(input: SoulReportInputRecord): string {
  return JSON.stringify(input);
}
