import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  Eye,
  FileText,
  RotateCcw,
  ArrowBigDown,
  ThumbsUp,
  Zap,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type {
  MaskedReviewItem,
  RevealedReviewItem,
  ReviewRating,
  ReviewSessionItem,
} from '../../api/client';
import { Button } from '../ui/Button';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface ReviewActiveSessionProps {
  session: ReviewSessionItem;
  currentItem: MaskedReviewItem | RevealedReviewItem;
  isRevealed: boolean;
  onReveal: () => Promise<void>;
  onRate: (rating: ReviewRating) => Promise<void>;
  onCompleteEarly: () => Promise<void>;
  onAbandon: () => Promise<void>;
  isRevealing: boolean;
  isRating: boolean;
  ratingError?: string | null;
}

const RATING_BUTTONS: {
  value: ReviewRating;
  label: string;
  sublabel: string;
  shortcut: string;
  icon: React.ReactNode;
  colorClass: string;
}[] = [
  {
    value: 'again',
    label: 'Again',
    sublabel: 'Repeat soon',
    shortcut: '1',
    icon: <RotateCcw size={15} />,
    colorClass:
      'border-error/40 bg-error/10 text-error hover:bg-error/20 hover:border-error/60 focus-visible:ring-error',
  },
  {
    value: 'hard',
    label: 'Hard',
    sublabel: 'Short interval',
    shortcut: '2',
    icon: <ArrowBigDown size={15} />,
    colorClass:
      'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 focus-visible:ring-amber-500',
  },
  {
    value: 'good',
    label: 'Good',
    sublabel: 'Normal interval',
    shortcut: '3',
    icon: <ThumbsUp size={15} />,
    colorClass:
      'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60 focus-visible:ring-emerald-500',
  },
  {
    value: 'easy',
    label: 'Easy',
    sublabel: 'Long interval',
    shortcut: '4',
    icon: <Zap size={15} />,
    colorClass:
      'border-accent-blue/40 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 hover:border-accent-blue/60 focus-visible:ring-accent-blue',
  },
];

export function ReviewActiveSession({
  session,
  currentItem,
  isRevealed,
  onReveal,
  onRate,
  onCompleteEarly,
  onAbandon,
  isRevealing,
  isRating,
  ratingError,
}: ReviewActiveSessionProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const revealedItem = isRevealed ? (currentItem as RevealedReviewItem) : null;

  const currentNumber = session.reviewed_items + 1;
  const totalCount = session.total_items;
  const progressPercent =
    totalCount > 0 ? Math.round((session.reviewed_items / totalCount) * 100) : 0;

  // Keyboard shortcut listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (!isRevealed) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          if (!isRevealing) {
            onReveal();
          }
        }
      } else {
        if (isRating) return;
        const ratingMap: Record<string, ReviewRating> = {
          '1': 'again',
          '2': 'hard',
          '3': 'good',
          '4': 'easy',
        };
        const selected = ratingMap[e.key];
        if (selected) {
          e.preventDefault();
          onRate(selected);
        }
      }
    },
    [isRevealed, isRevealing, isRating, onReveal, onRate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const sourceMeta = currentItem.source_metadata?.[0];
  const sourceTitle = sourceMeta?.document_title || sourceMeta?.title;
  const sourcePage = sourceMeta?.page_number;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
      {/* Session Progress Header */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <BrainCircuit size={15} />
          </div>
          <div>
            <span className="text-xs font-black text-on-surface">Daily Review Session</span>
            <span className="text-[10px] text-on-surface-variant block">
              Card {Math.min(currentNumber, totalCount)} of {totalCount}
            </span>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="flex-1 max-w-xs flex items-center gap-2.5">
          <div
            className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden border border-border-default/50"
            role="progressbar"
            aria-valuenow={session.reviewed_items}
            aria-valuemin={0}
            aria-valuemax={totalCount}
          >
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-black text-on-surface tabular-nums shrink-0">
            {session.reviewed_items}/{totalCount}
          </span>
        </div>

        {/* Exit / Options Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExitConfirm(true)}
          className="text-xs font-bold text-on-surface-variant hover:text-on-surface shrink-0"
          title="Exit review session"
        >
          <X size={14} />
          <span className="hidden sm:inline">Exit</span>
        </Button>
      </div>

      {/* Rating Error Alert Banner */}
      {ratingError && (
        <div className="p-3 rounded-xl border border-error/40 bg-error/10 text-error flex items-center gap-2.5 text-xs font-bold">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1">{ratingError}</span>
        </div>
      )}

      {/* Main Study Card */}
      <div
        className="border-2 border-border-default rounded-2xl bg-surface shadow-neo overflow-hidden"
        role="region"
        aria-label="Review Card"
      >
        {/* Card Header Tag */}
        <div className="px-6 py-3 border-b border-border-default/60 bg-surface-container-low/40 flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-2">
            <span className="text-primary font-black uppercase tracking-wider text-[10px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
              {currentItem.content_type === 'flashcard' ? 'Flashcard' : 'Quiz Question'}
            </span>
            <span className="text-on-surface-variant font-medium">Order #{currentItem.order_index + 1}</span>
          </div>
          {sourceTitle && (
            <div className="flex items-center gap-1 text-on-surface-variant truncate max-w-[220px]">
              <FileText size={11} className="shrink-0 opacity-60" />
              <span className="truncate">{sourceTitle}</span>
              {sourcePage != null && <span>· p.{sourcePage}</span>}
            </div>
          )}
        </div>

        {/* Front Prompt / Question */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="text-base sm:text-lg font-bold text-on-surface leading-relaxed">
            <MarkdownRenderer content={currentItem.front || 'Question prompt'} />
          </div>

          {/* If Quiz question has multiple choice options */}
          {currentItem.options && currentItem.options.length > 0 && !isRevealed && (
            <div className="pt-3 border-t border-border-default/40 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                Options
              </span>
              <div className="grid grid-cols-1 gap-2">
                {currentItem.options.map((opt, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-border-default/60 bg-surface-container-low/50 text-xs font-semibold text-on-surface"
                  >
                    <span className="font-mono text-on-surface-variant mr-2">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Revealed Back / Answer Section or Reveal CTA */}
        {!isRevealed ? (
          <div className="border-t-2 border-border-default p-6 sm:p-8 bg-surface-container-low/30 text-center space-y-2">
            <Button
              variant="secondary"
              size="lg"
              className="w-full justify-center gap-2 font-black text-base shadow-neo-sm"
              onClick={onReveal}
              isLoading={isRevealing}
              aria-label="Reveal Answer"
            >
              <Eye size={18} />
              Reveal Answer
            </Button>
            <p className="text-[10px] text-on-surface-variant font-medium">
              Press <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface text-on-surface font-bold text-[10px]">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded border border-border-default bg-surface text-on-surface font-bold text-[10px]">Enter</kbd> to reveal
            </p>
          </div>
        ) : (
          <div className="border-t-2 border-primary/30 p-6 sm:p-8 bg-primary/[0.03] space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                Answer
              </span>
              <span className="text-[11px] font-bold text-on-surface-variant">
                Rate your recall below
              </span>
            </div>

            <div className="text-sm sm:text-base text-on-surface leading-relaxed prose-sm dark:prose-invert prose-strong:text-on-surface prose-strong:font-bold prose-code:text-primary dark:prose-code:text-sky-300">
              <MarkdownRenderer content={revealedItem?.back || ''} />
            </div>

            {revealedItem?.explanation && (
              <div className="pt-3 border-t border-border-default/40 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70">
                  Explanation
                </span>
                <div className="text-xs text-on-surface-variant leading-relaxed prose-xs dark:prose-invert">
                  <MarkdownRenderer content={revealedItem.explanation} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4-Point FSRS Rating Controls */}
      {isRevealed && (
        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-3">
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
            role="group"
            aria-label="FSRS Recall Rating"
          >
            {RATING_BUTTONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onRate(r.value)}
                disabled={isRating}
                className={`flex flex-col items-center justify-center gap-1 py-3 sm:py-4 rounded-xl border-2 font-black transition-all duration-120 ease-out cursor-pointer select-none
                  disabled:opacity-50 disabled:pointer-events-none
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  active:scale-95 active:shadow-none
                  shadow-neo-sm hover:shadow-neo hover:-translate-x-[0.5px] hover:-translate-y-[0.5px]
                  ${r.colorClass}`}
                aria-label={`Rate recall as ${r.label} (press ${r.shortcut})`}
              >
                <div className="flex items-center gap-1.5">
                  {r.icon}
                  <span className="text-xs sm:text-sm">{r.label}</span>
                </div>
                <span className="text-[10px] opacity-75 font-semibold">{r.sublabel}</span>
                <kbd className="text-[9px] font-bold opacity-60 mt-0.5 hidden sm:inline">
                  [{r.shortcut}]
                </kbd>
              </button>
            ))}
          </div>
          <p className="text-center text-[10px] text-on-surface-variant font-medium">
            Keys: <kbd className="px-1 py-0.5 rounded border border-border-default bg-surface font-mono">1</kbd> Again · <kbd className="px-1 py-0.5 rounded border border-border-default bg-surface font-mono">2</kbd> Hard · <kbd className="px-1 py-0.5 rounded border border-border-default bg-surface font-mono">3</kbd> Good · <kbd className="px-1 py-0.5 rounded border border-border-default bg-surface font-mono">4</kbd> Easy
          </p>
        </div>
      )}

      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-border-default bg-surface p-6 shadow-neo-lg space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-black text-on-surface">Exit Review Session?</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              All ratings completed so far have been saved to your spaced repetition schedule. You can complete the session now or abandon the remaining cards.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowExitConfirm(false);
                  onCompleteEarly();
                }}
                className="w-full justify-center font-bold text-xs shadow-neo-xs"
              >
                Complete Session Early ({session.reviewed_items} reviewed)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowExitConfirm(false);
                  onAbandon();
                }}
                className="w-full justify-center font-bold text-xs"
              >
                Abandon Session
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExitConfirm(false)}
                className="w-full justify-center text-xs text-on-surface-variant"
              >
                Continue Reviewing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
