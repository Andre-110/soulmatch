'use client';

import { ANALYZE_STAGE_META, type AnalyzeStageKey } from '@/lib/analyzeStages';

type StageTimelineEntry = {
  stage: AnalyzeStageKey;
  timestamp: number;
  durationMs: number;
  aggregated: {
    count: number;
    avgMs: number;
    lastMs: number;
  };
};

type Props = {
  analysisStatus: string;
  analysisStage: AnalyzeStageKey;
  currentStagePercent: number;
  bindingCount: number;
  screenshotCount: number;
  stageTimeline: StageTimelineEntry[];
  analyzeChecklist: Array<{ key: AnalyzeStageKey; label: string }>;
  deriveStageEta: (stage: AnalyzeStageKey) => string;
};

export function AnalyzeProgress({
  analysisStatus,
  analysisStage,
  currentStagePercent,
  bindingCount,
  screenshotCount,
  stageTimeline,
  analyzeChecklist,
  deriveStageEta,
}: Props) {
  return (
    <div className="view-content view-loading">
      <h2 className="loading-title">正在生成你的灵魂档案<br />请稍候…</h2>
      <div className="hatching-container"><div className="hatching-orb"></div></div>
      <p className="loading-status loading-status-text">{analysisStatus}</p>
      <div className="ref-loading-progress">
        <div className="ref-loading-progress-row">
          <span>当前进度</span>
          <span>{currentStagePercent}%</span>
        </div>
        <div className="ref-loading-progress-track">
          <div className="ref-loading-progress-fill" style={{ width: `${currentStagePercent}%` }} />
        </div>
        <p className="ref-loading-eta">{deriveStageEta(analysisStage)}</p>
      </div>
      <div className="ref-loading-stage-list">
        {analyzeChecklist.map(({ key, label }) => {
          const stageDone = ANALYZE_STAGE_META[analysisStage].percent > ANALYZE_STAGE_META[key].percent;
          const isCurrent = analysisStage === key;
          return (
            <div
              key={label}
              className={`ref-loading-stage-item${stageDone ? ' done' : ''}${isCurrent ? ' current' : ''}`}
            >
              <span className="ref-loading-stage-icon">{stageDone ? '✓' : isCurrent ? '●' : '⋯'}</span>
              <span>
                {label}
                <span className="ref-loading-stage-sub">
                  {key === 'scraping'
                    ? `已绑定 ${bindingCount} 个平台`
                    : key === 'vision'
                      ? `正在分析 ${screenshotCount} 张截图`
                      : key === 'prompting'
                        ? `AI 整合 ${bindingCount} 平台 + ${screenshotCount} 视觉线索`
                        : null}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {stageTimeline.length > 0 && (
        <div className="ref-stage-timeline">
          {stageTimeline.map((entry) => (
            <div key={`${entry.stage}-${entry.timestamp}`} className="ref-stage-timeline-item">
              <div className="ref-stage-timeline-head">
                <strong>{ANALYZE_STAGE_META[entry.stage].label}</strong>
                <span>{(entry.durationMs / 1000).toFixed(1)}s</span>
              </div>
              <div className="ref-stage-timeline-meta">
                平均 {(entry.aggregated.avgMs / 1000).toFixed(1)}s · {entry.aggregated.count} 次 · 最近 {(entry.aggregated.lastMs / 1000).toFixed(1)}s
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
