import { ANALYZE_STAGE_KEYS, AnalyzeStageKey } from '@/lib/analyzeStages';

type TimingEntry = {
  totalMs: number;
  count: number;
  maxMs: number;
  lastMs?: number;
};

const stats: Record<AnalyzeStageKey, TimingEntry> = ANALYZE_STAGE_KEYS.reduce((acc, stage) => {
  acc[stage] = { totalMs: 0, count: 0, maxMs: 0 };
  return acc;
}, {} as Record<AnalyzeStageKey, TimingEntry>);

export type AnalyzeStageTimingSnapshot = {
  stage: AnalyzeStageKey;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  count: number;
};

export function recordAnalyzeStageDuration(stage: AnalyzeStageKey, durationMs: number): AnalyzeStageTimingSnapshot {
  const entry = stats[stage];
  entry.count += 1;
  entry.totalMs += durationMs;
  entry.maxMs = Math.max(entry.maxMs, durationMs);
  entry.lastMs = durationMs;
  return {
    stage,
    avgMs: entry.count > 0 ? entry.totalMs / entry.count : durationMs,
    maxMs: entry.maxMs,
    lastMs: durationMs,
    count: entry.count,
  };
}

export function snapshotAnalyzeStageTimings(): Record<AnalyzeStageKey, AnalyzeStageTimingSnapshot> {
  return Object.fromEntries(
    ANALYZE_STAGE_KEYS.map((stage) => {
      const entry = stats[stage];
      return [
        stage,
        {
          stage,
          avgMs: entry.count > 0 ? entry.totalMs / entry.count : 0,
          maxMs: entry.maxMs,
          lastMs: entry.lastMs ?? 0,
          count: entry.count,
        },
      ];
    }),
  ) as Record<AnalyzeStageKey, AnalyzeStageTimingSnapshot>;
}
