import React from 'react';
import { Check } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import type { MaskedQuizQuestion } from '../../api/client';

export interface MultipleChoiceQuestionProps {
  question: MaskedQuizQuestion;
  selectedAnswer?: string;
  onSelectAnswer: (answer: string) => void;
  disabled?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function MultipleChoiceQuestion({
  question,
  selectedAnswer,
  onSelectAnswer,
  disabled,
}: MultipleChoiceQuestionProps) {
  return (
    <div className="space-y-6 w-full" role="radiogroup" aria-label="Question options">
      {/* Question Prompt */}
      <div className="text-base sm:text-lg font-bold text-on-surface leading-relaxed">
        <MarkdownRenderer content={question.question} />
      </div>

      {/* Options List */}
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          // Check both index string ("0", "1") and exact string equality
          const isSelected =
            selectedAnswer === String(idx) ||
            selectedAnswer?.trim().toLowerCase() === option.trim().toLowerCase();
          const letter = OPTION_LETTERS[idx] || String(idx + 1);

          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelectAnswer(String(idx))}
              className={`w-full flex items-start gap-3.5 p-4 rounded-xl border-2 text-left transition-all duration-120 cursor-pointer select-none ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-neo font-bold text-on-surface'
                  : 'border-border-default hover:border-primary/40 hover:bg-surface-container bg-surface text-on-surface shadow-neo-sm'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {/* Option Letter Badge */}
              <span
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 text-xs font-black transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary text-on-primary shadow-neo-sm'
                    : 'border-border-default bg-surface-container text-on-surface-variant'
                }`}
              >
                {isSelected ? <Check size={14} strokeWidth={3} /> : letter}
              </span>

              {/* Option Text */}
              <div className="flex-1 text-sm sm:text-base leading-snug pt-0.5">
                <MarkdownRenderer content={option} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
