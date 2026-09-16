import React from 'react';
import type { MaskedQuizQuestion } from '../../api/client';

export interface QuestionNavigatorProps {
  questions: MaskedQuizQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  onSelectQuestion: (index: number) => void;
  disabled?: boolean;
}

export function QuestionNavigator({
  questions,
  currentIndex,
  answers,
  onSelectQuestion,
  disabled,
}: QuestionNavigatorProps) {
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== ''
  ).length;

  return (
    <div className="space-y-3" role="navigation" aria-label="Questions overview">
      <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant px-1">
        <span>Questions Overview</span>
        <span className="tabular-nums">
          <span className="text-primary font-black">{answeredCount}</span> / {questions.length} answered
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {questions.map((q, idx) => {
          const isCurrent = currentIndex === idx;
          const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';

          return (
            <button
              key={q.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectQuestion(idx)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 flex items-center justify-center text-xs font-black transition-all cursor-pointer select-none ${
                isCurrent
                  ? 'border-primary bg-primary text-on-primary shadow-neo ring-2 ring-primary/30 ring-offset-2'
                  : isAnswered
                  ? 'border-emerald-600/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:border-emerald-600'
                  : 'border-border-default bg-surface hover:bg-surface-container text-on-surface-variant'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unanswered)'}${isCurrent ? ' (Current)' : ''}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
