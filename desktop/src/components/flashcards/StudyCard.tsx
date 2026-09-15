import React from 'react';
import { Eye, FileText } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Button } from '../ui/Button';
import type { MaskedReviewItem, RevealedReviewItem } from '../../api/client';

export interface StudyCardProps {
  item: MaskedReviewItem | RevealedReviewItem;
  isRevealed: boolean;
  onReveal: () => void;
  isRevealing: boolean;
}

export function StudyCard({ item, isRevealed, onReveal, isRevealing }: StudyCardProps) {
  const revealedItem = isRevealed ? (item as RevealedReviewItem) : null;

  const sourceDoc = item.source_metadata?.[0];
  const sourceTitle = sourceDoc?.document_title || sourceDoc?.title;
  const sourcePage = sourceDoc?.page_number;

  return (
    <div
      className="w-full max-w-2xl mx-auto"
      role="region"
      aria-label="Study card"
      aria-live="polite"
    >
      <div className="border-2 border-border-default rounded-2xl bg-surface shadow-neo overflow-hidden">
        {/* Front / Question */}
        <div className="p-6 sm:p-8 space-y-4">
          <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
            Question
          </span>
          <div className="text-base sm:text-lg font-bold text-on-surface leading-relaxed">
            <MarkdownRenderer content={item.front} />
          </div>

          {/* Source reference */}
          {sourceTitle && (
            <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium pt-1 border-t border-border-default/40">
              <FileText size={11} className="shrink-0 opacity-60" />
              <span className="truncate">{sourceTitle}</span>
              {sourcePage != null && <span className="shrink-0">· p.{sourcePage}</span>}
            </div>
          )}
        </div>

        {/* Reveal Button or Answer */}
        {!isRevealed ? (
          <div className="border-t-2 border-border-default p-6 sm:p-8 bg-surface-container-low/30">
            <Button
              variant="secondary"
              size="lg"
              className="w-full justify-center gap-2 font-black text-base"
              onClick={onReveal}
              isLoading={isRevealing}
              aria-label="Reveal answer"
            >
              <Eye size={18} />
              Reveal Answer
            </Button>
            <p className="text-center text-[10px] text-on-surface-variant font-medium mt-2.5 motion-safe:animate-pulse">
              Press <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface text-on-surface font-bold text-[10px]">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface text-on-surface font-bold text-[10px]">Enter</kbd>
            </p>
          </div>
        ) : (
          <div className="border-t-2 border-primary/30 p-6 sm:p-8 bg-primary/[0.03] space-y-3">
            <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              Answer
            </span>
            <div className="text-sm sm:text-base text-on-surface leading-relaxed prose-sm dark:prose-invert prose-strong:text-on-surface prose-strong:font-bold prose-em:text-on-surface prose-code:text-primary dark:prose-code:text-sky-300">
              <MarkdownRenderer content={revealedItem?.back || ''} />
            </div>
            {revealedItem?.explanation && (
              <div className="pt-3 border-t border-border-default/40 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
                  Explanation
                </span>
                <div className="text-xs text-on-surface-variant leading-relaxed prose-xs dark:prose-invert prose-strong:text-on-surface prose-strong:font-bold">
                  <MarkdownRenderer content={revealedItem.explanation} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
