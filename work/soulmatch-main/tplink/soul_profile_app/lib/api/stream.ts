import { type AnalyzeStageKey } from '@/lib/analyzeStages';

export type AnalyzeStageEvent = {
  type: 'stage';
  stage: AnalyzeStageKey;
  message?: string;
};

export type AnalyzeStageDurationEvent = {
  type: 'stageDuration';
  stage: AnalyzeStageKey;
  durationMs: number;
  aggregated: {
    avgMs: number;
    count: number;
    maxMs: number;
    lastMs: number;
  };
};

export type AnalyzeSnapshot = {
  submission?: {
    startedAt?: string | null;
    totalUploads: number;
    platformBindings: number;
    userScreenshots: number;
    textEntries: number;
    hasMatchIntent: boolean;
  };
  scrape?: {
    requestedPlatforms: number;
    succeededPlatforms: number;
    failedPlatforms: number;
  };
  vision?: {
    selectedImages: number;
    userUploadImages: number;
    platformImages: number;
  };
  output?: {
    source: 'openai' | 'fallback' | 'cache';
    model?: string | null;
  };
};

export type AnalyzeSnapshotEvent = {
  type: 'snapshot';
  snapshot: AnalyzeSnapshot;
};

export type StageTimelineEntry = AnalyzeStageDurationEvent & { timestamp: number };

/** 解析 /api/analyze 的 NDJSON 流（服务端定时 ping，避免反代 502） */
export async function readAnalyzeNdjsonStream(res: Response): Promise<{
  report: unknown;
  userScreenshotUrls: string[];
  mbtiIp: unknown;
}> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法读取响应');
  const decoder = new TextDecoder();
  let buffer = '';
  let done: {
    report: unknown;
    userScreenshotUrls: string[];
    mbtiIp: unknown;
  } | null = null;
  let errPayload: { status?: number; error?: string } | null = null;
  const consumeLine = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const j = JSON.parse(t) as {
      type?: string;
      status?: number;
      error?: string;
      report?: unknown;
      userScreenshotUrls?: string[];
      mbtiIp?: unknown;
    };
    if (j.type === 'done' && j.report !== undefined) {
      done = {
        report: j.report,
        userScreenshotUrls: Array.isArray(j.userScreenshotUrls) ? j.userScreenshotUrls : [],
        mbtiIp: j.mbtiIp ?? null,
      };
    }
    if (j.type === 'error') errPayload = { status: j.status, error: j.error };
  };
  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) consumeLine(line);
    if (streamDone) {
      if (buffer.trim()) consumeLine(buffer);
      break;
    }
  }
  if (errPayload) {
    const e = new Error(errPayload.error || '请求错误') as Error & { status?: number };
    e.status = errPayload.status;
    throw e;
  }
  if (!done) throw new Error('未收到分析结果');
  return done;
}

export async function readAnalyzeNdjsonStreamWithEvents(
  res: Response,
  options?: {
    onStage?: (event: AnalyzeStageEvent) => void;
    onStageDuration?: (event: AnalyzeStageDurationEvent) => void;
    onSnapshot?: (event: AnalyzeSnapshotEvent) => void;
  },
): Promise<{
  report: unknown;
  userScreenshotUrls: string[];
  mbtiIp: unknown;
}> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法读取响应');
  const decoder = new TextDecoder();
  let buffer = '';
  let done: {
    report: unknown;
    userScreenshotUrls: string[];
    mbtiIp: unknown;
  } | null = null;
  let errPayload: { status?: number; error?: string } | null = null;
  const consumeLine = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const j = JSON.parse(t) as {
      type?: string;
      stage?: AnalyzeStageKey;
      message?: string;
      status?: number;
      error?: string;
      report?: unknown;
      userScreenshotUrls?: string[];
      mbtiIp?: unknown;
      durationMs?: number;
      aggregated?: {
        avgMs: number;
        count: number;
        maxMs: number;
        lastMs: number;
      };
      snapshot?: AnalyzeSnapshot;
    };
    if (j.type === 'stage' && j.stage) {
      options?.onStage?.({ type: 'stage', stage: j.stage, message: j.message });
      return;
    }
    if (j.type === 'stageDuration' && j.stage && typeof j.durationMs === 'number' && j.aggregated) {
      options?.onStageDuration?.({
        type: 'stageDuration',
        stage: j.stage,
        durationMs: j.durationMs,
        aggregated: j.aggregated,
      });
      return;
    }
    if (j.type === 'snapshot' && j.snapshot) {
      options?.onSnapshot?.({
        type: 'snapshot',
        snapshot: j.snapshot,
      });
      return;
    }
    if (j.type === 'done' && j.report !== undefined) {
      done = {
        report: j.report,
        userScreenshotUrls: Array.isArray(j.userScreenshotUrls) ? j.userScreenshotUrls : [],
        mbtiIp: j.mbtiIp ?? null,
      };
    }
    if (j.type === 'error') errPayload = { status: j.status, error: j.error };
  };
  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) consumeLine(line);
    if (streamDone) {
      if (buffer.trim()) consumeLine(buffer);
      break;
    }
  }
  if (errPayload) {
    const e = new Error(errPayload.error || '请求错误') as Error & { status?: number };
    e.status = errPayload.status;
    throw e;
  }
  if (!done) throw new Error('未收到分析结果');
  return done;
}
