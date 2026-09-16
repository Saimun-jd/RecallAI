import React from 'react';
import { Check, X } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import type { MaskedQuizQuestion } from '../../api/client';

export interface TrueFalseQuestionProps {
  question: MaskedQuizQuestion;
  selectedAnswer?: string;
  onSelectAnswer: (answer: string) => void;
  disabled?: boolean;
}

export function TrueFalseQuestion({
  question,
  selectedAnswer,
  onSelectAnswer,
  disabled,
}: TrueFalseQuestionProps) {
  const isTrueSelected =
    selectedAnswer?.toLowerCase() === 'true' || selectedAnswer === '0';
  const isFalseSelected =
    selectedAnswer?.toLowerCase() === 'false' || selectedAnswer === '1';

  return (
    <div className="space-y-6 w-full" role="radiogroup" aria-label="True or False options">
      {/* Question Prompt */}
      <div className="text-base sm:text-lg font-bold text-on-surface leading-relaxed">
        <MarkdownRenderer content={question.question} />
      </div>

      {/* True / False Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* True Option */}
        <button
          type="button"
          role="radio"
          aria-checked={isTrueSelected}
          disabled={disabled}
          onClick={() => onSelectAnswer('true')}
          className={`flex items-center justify-center gap-3 p-5 rounded-2xl border-2 font-black text-base transition-all duration-120 cursor-pointer select-none ${
            isTrueSelected
              ? 'border-emerald-600 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-neo'
              : 'border-border-default hover:border-emerald-500/40 hover:bg-surface-container bg-surface text-on-surface shadow-neo-sm'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div
            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 text-xs ${
              isTrueSelected
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-neo-sm'
                : 'border-border-default bg-surface-container text-on-surface-variant'
            }`}
          >
            <Check size={16} strokeWidth={3} />
          </div>
          <span>True</span>
        </button>

        {/* False Option */}
        <button
          type="button"
          role="radio"
          aria-checked={isFalseSelected}
          disabled={disabled}
          onClick={() => onSelectAnswer('false')}
          className={`flex items-center justify-center gap-3 p-5 rounded-2xl border-2 font-black text-base transition-all duration-120 cursor-pointer select-none ${
            isFalseSelected
              ? 'border-error bg-error/15 text-error shadow-neo'
              : 'border-border-default hover:border-error/40 hover:bg-surface-container bg-surface text-on-surface shadow-neo-sm'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div
            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 text-xs ${
              isFalseSelected
                ? 'border-error bg-error text-white shadow-neo-sm'
                : 'border-border-default bg-surface-container text-on-surface-variant'
            }`}
          >
            <X size={16} strokeWidth={3} />
          </div>
          <span>False</span>
        </button>
      </div>
    </div>
  );
}
