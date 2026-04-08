'use client';

import type { ReactNode } from 'react';

type Props = {
  debugMode: boolean;
  bindingCount: number;
  activePlatformCount: number;
  xhsBindingEnabled: boolean;
  platformRows: ReactNode;
  onSkipDebug: () => void;
  onNext: () => void;
};

export function PlatformBindingStep({
  debugMode,
  bindingCount,
  activePlatformCount,
  xhsBindingEnabled,
  platformRows,
  onSkipDebug,
  onNext,
}: Props) {
  return (
    <div className="step-body">
      {debugMode && (
        <button
          type="button"
          className="btn btn-secondary debug-skip-btn"
          onClick={onSkipDebug}
        >
          🚀 Debug: 跳到问卷
        </button>
      )}
      <h2 className="step-title ref-platform-main-title">
        社交平台（仅获取公开数据，用来创建分身）
      </h2>
      <p className="ref-platform-yellow">
        通过你填写的本人社交账号，创建独一无二的你的专属数字分身，绑定越多你的分身将越像你。所有数据均在此平台你本人使用，随时可解绑，无隐私风险。
      </p>
      <div className="ref-platform-summary">
        <div className="ref-platform-summary-card">
          <strong>{bindingCount}</strong>
          <span>已绑定平台</span>
        </div>
        <div className="ref-platform-summary-card">
          <strong>{activePlatformCount}</strong>
          <span>当前可接入平台</span>
        </div>
        <div className="ref-platform-summary-card">
          <strong>公开</strong>
          <span>仅读取主页公开信息</span>
        </div>
      </div>
      <div className="platform-list">
        {platformRows}
      </div>
      {!xhsBindingEnabled && (
        <p className="platform-warning">
          小红书入口已暂时关闭，后续恢复后会重新开放。
        </p>
      )}
      <div className="bottom-action ref-chat-bottom-action">
        <button type="button" className="btn btn-primary btn-glow" onClick={onNext}>
          下一步 →
        </button>
      </div>
    </div>
  );
}
