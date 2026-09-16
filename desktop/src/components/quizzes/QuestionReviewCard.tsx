import React from 'react';
import { CheckCircle2, XCircle, HelpCircle, FileText, Lightbulb } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Tag } from '../ui/Tag';
import type { QuestionEvaluationResult } from '../../api/client';

export interface QuestionReviewCardProps {
  result: QuestionEvaluationResult;
  index: number;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function QuestionReviewCard({ result, index }: QuestionReviewCardProps) {
  const isUnanswered = result.selected_answer === '' || result.selected_answer === undefined;
  const isCorrect = result.is_correct;

  const sourceDoc = result.source_metadata?.[0];
  const sourceTitle = sourceDoc?.document_title || sourceDoc?.title;
  const sourcePage = sourceDoc?.page_number;

  // Format option display
  const renderOptionStatus = (optionIdx: number, optionText: string) => {
    const isUserChoice =
      result.selected_answer === String(optionIdx) ||
      result.selected_answer?.trim().toLowerCase() === optionText.trim().toLowerCase();

    const isCorrectChoice =
      result.correct_answer === String(optionIdx) ||
      result.correct_answer?.trim().toLowerCase() === optionText.trim().toLowerCase();

    let borderClass = 'border-border-default/60 bg-surface';
    let textClass = 'text-on-surface-variant';
    let badgeClass = 'border-border-default bg-surface-container text-on-surface-variant';
    let icon = null;

    if (isCorrectChoice) {
      borderClass = 'border-emerald-500 bg-emerald-500/10 shadow-neo-sm font-bold';
      textClass = 'text-emerald-900 dark:text-emerald-300';
      badgeClass = 'border-emerald-600 bg-emerald-600 text-white';
      icon = <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
    } else if (isUserChoice && !isCorrect) {
      borderClass = 'border-error bg-error/10 shadow-neo-sm font-bold';
      textClass = 'text-error';
      badgeClass = 'border-error bg-error text-white';
      icon = <XCircle size={16} className="text-error shrink-0" />;
    }

    const letter = OPTION_LETTERS[optionIdx] || String(optionIdx + 1);

    return (
      <div
        key={optionIdx}
        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all ${borderClass}`}
      >
        <span
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 text-xs font-black ${badgeClass}`}
        >
          {letter}
        </span>
        <div className={`flex-1 text-sm leading-snug pt-0.5 ${textClass}`}>
          <MarkdownRenderer content={optionText} />
        </div>
        {icon}
      </div>
    );
  };

  return (
    <div
      className={`border-2 rounded-2xl bg-surface p-5 sm:p-6 shadow-neo space-y-4 transition-all ${
        isCorrect
          ? 'border-emerald-500/40'
          : isUnanswered
          ? 'border-amber-500/40'
          : 'border-error/40'
      }`}
      role="article"
      aria-label={`Question ${index + 1} review`}
    >
      {/* Header with question number and correctness tag */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-surface-container text-on-surface border border-border-default flex items-center justify-center text-xs font-black">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            {result.type === 'true_false' ? 'True / False' : 'Multiple Choice'}
          </span>
        </div>

        {isCorrect ? (
          <Tag variant="success" size="sm" className="gap-1 font-black">
            <CheckCircle2 size={13} />
            <span>Correct</span>
          </Tag>
        ) : isUnanswered ? (
          <Tag variant="warning" size="sm" className="gap-1 font-black">
            <HelpCircle size={13} />
            <span>Unanswered</span>
          </Tag>
        ) : (
          <Tag variant="error" size="sm" className="gap-1 font-black">
            <XCircle size={13} />
            <span>Incorrect</span>
          </Tag>
        )}
      </div>

      {/* Question Text */}
      <div className="text-base font-bold text-on-surface leading-relaxed">
        <MarkdownRenderer content={result.question} />
      </div>

      {/* Options List */}
      {result.type === 'true_false' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {['True', 'False'].map((tf, i) => renderOptionStatus(i, tf))}
        </div>
      ) : (
        result.options && (
          <div className="space-y-2.5 pt-1">
            {result.options.map((opt, i) => renderOptionStatus(i, opt))}
          </div>
        )
      )}

      {/* Explanation Box */}
      {result.explanation && (
        <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/[0.03] space-y-1.5 mt-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-primary">
            <Lightbulb size={14} className="shrink-0" />
            <span>Explanation</span>
          </div>
          <div className="text-xs sm:text-sm text-on-surface leading-relaxed prose-xs">
            <MarkdownRenderer content={result.explanation} />
          </div>
        </div>
      )}

      {/* Grounded Source Citation */}
      {sourceTitle && (
        <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium pt-2 border-t border-border-default/50">
          <FileText size={11} className="shrink-0 opacity-60" />
          <span className="font-bold">Source:</span>
          <span className="truncate">{sourceTitle}</span>
          {sourcePage != null && <span>· p.{sourcePage}</span>}
        </div>
      )}
    </div>
  );
}
