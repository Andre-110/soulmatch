'use client';

import type { ReactNode } from 'react';

type Props = {
  debugMode: boolean;
  debugSkipLabel?: string;
  uploadSection: ReactNode;
  onSkipDebug: () => void;
  onNext: () => void;
};

export function UploadMediaStep({ debugMode, debugSkipLabel = '🚀 Debug: 跳到问卷', uploadSection, onSkipDebug, onNext }: Props) {
  return (
    <div className="step-body ref-step1-body">
      {debugMode && (
        <button
          type="button"
          className="btn btn-secondary debug-skip-btn"
          onClick={onSkipDebug}
        >
          {debugSkipLabel}
        </button>
      )}
      {uploadSection}

      <div className="bottom-action ref-step-bottom-action">
        <button type="button" className="btn btn-primary btn-glow" onClick={onNext}>
          下一步 →
        </button>
      </div>
    </div>
  );
}
