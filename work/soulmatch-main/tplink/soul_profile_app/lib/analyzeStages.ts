export const ANALYZE_STAGE_KEYS = ['queued', 'gathering', 'scraping', 'vision', 'prompting', 'saving', 'done'] as const;
export type AnalyzeStageKey = (typeof ANALYZE_STAGE_KEYS)[number];
