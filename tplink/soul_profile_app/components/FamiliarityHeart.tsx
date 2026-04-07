"use client";

export function FamiliarityHeart({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="ref-familiarity-float">
      <span className="ref-familiarity-label">了解程度</span>
      <div className="ref-familiarity-heart" aria-hidden>
        <div className="ref-familiarity-fill" style={{ height: `${p}%` }} />
        <span className="ref-familiarity-num">{p}%</span>
      </div>
    </div>
  );
}
