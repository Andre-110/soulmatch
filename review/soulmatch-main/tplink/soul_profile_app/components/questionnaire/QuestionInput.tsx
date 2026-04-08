'use client';

import { useRef } from 'react';

type HeightPreferenceAnswer = {
  myHeight: number;
  preferredMin: number;
  preferredMax: number;
};

type Question = {
  id: number;
  type: 'text' | 'height' | 'single' | 'tags' | 'scale';
  title: string;
  prompt: string;
  options?: string[];
  required?: boolean;
  helper?: string;
};

type QuestionAnswer = string | string[] | number | HeightPreferenceAnswer | undefined;

const SCALE_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

type Props = {
  question: Question;
  answer: QuestionAnswer;
  isReadOnly?: boolean;
  onUpdateAnswer: (questionId: number, answer: QuestionAnswer) => void;
  onToggleTag: (questionId: number, tag: string) => void;
};

export function QuestionInput({ question, answer, isReadOnly = false, onUpdateAnswer, onToggleTag }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (question.type === 'text') {
    const value = typeof answer === 'string' ? answer : '';
    return (
      <textarea
        ref={textareaRef}
        className="ref-q-input glass-input"
        placeholder={isReadOnly ? '' : '请输入你的回答...'}
        value={value}
        readOnly={isReadOnly}
        onChange={(e) => onUpdateAnswer(question.id, e.target.value)}
        rows={3}
      />
    );
  }

  if (question.type === 'height') {
    const range = (answer || { myHeight: 172, preferredMin: 165, preferredMax: 182 }) as HeightPreferenceAnswer;
    const myHeight = typeof range.myHeight === 'number' ? range.myHeight : 172;
    const preferredMin = typeof range.preferredMin === 'number' ? range.preferredMin : 165;
    const preferredMax = typeof range.preferredMax === 'number' ? range.preferredMax : 182;
    return (
      <div className="ref-range-wrap">
        <div className="ref-range-label">我的身高：{myHeight}cm</div>
        <input
          type="range"
          min={140}
          max={210}
          step={1}
          value={myHeight}
          className="ref-height-range"
          onChange={(e) => onUpdateAnswer(question.id, { ...range, myHeight: Number(e.target.value) })}
        />
        <div className="ref-range-label">期望对方身高：{preferredMin}cm - {preferredMax}cm</div>
        <input
          type="range"
          min={140}
          max={210}
          step={1}
          value={preferredMin}
          className="ref-height-range"
          onChange={(e) => {
            const val = Number(e.target.value);
            onUpdateAnswer(question.id, { ...range, preferredMin: Math.min(val, preferredMax), preferredMax });
          }}
        />
        <input
          type="range"
          min={140}
          max={210}
          step={1}
          value={preferredMax}
          className="ref-height-range"
          onChange={(e) => {
            const val = Number(e.target.value);
            onUpdateAnswer(question.id, { ...range, preferredMin, preferredMax: Math.max(val, preferredMin) });
          }}
        />
      </div>
    );
  }

  if (question.type === 'single') {
    const value = typeof answer === 'string' ? answer : '';
    return (
      <div className="ref-choice-grid">
        {(question.options || []).map((option) => (
          <button
            key={option}
            type="button"
            className={`ref-choice-btn${value === option ? ' active' : ''}`}
            onClick={() => onUpdateAnswer(question.id, option)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'tags') {
    const values = Array.isArray(answer) ? (answer as string[]) : [];
    return (
      <>
        <div className="ref-choice-grid ref-choice-grid-tags">
          {(question.options || []).map((option) => (
            <button
              key={option}
              type="button"
              className={`ref-choice-btn ref-choice-tag${values.includes(option) ? ' active' : ''}`}
              onClick={() => onToggleTag(question.id, option)}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="ref-q-tag-hint">已选 {values.length}/3</p>
      </>
    );
  }

  if (question.type === 'scale') {
    const value = typeof answer === 'number' ? answer : 0;
    return (
      <div className="ref-scale-wrap">
        <div className="ref-scale-grid">
          {SCALE_OPTIONS.map((num) => (
            <button
              key={num}
              type="button"
              className={`ref-scale-btn${value === num ? ' active' : ''}`}
              onClick={() => onUpdateAnswer(question.id, num)}
            >
              {num}
            </button>
          ))}
        </div>
        <div className="ref-scale-labels">
          <span>完全不符合</span>
          <span>非常符合</span>
        </div>
      </div>
    );
  }

  return null;
}
