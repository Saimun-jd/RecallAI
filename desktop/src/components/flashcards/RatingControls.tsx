import React, { useEffect, useCallback } from 'react';
import { RotateCcw, ArrowBigDown, ThumbsUp, Zap } from 'lucide-react';
import type { ReviewRating } from '../../api/client';

export interface RatingControlsProps {
  onRate: (rating: ReviewRating) => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

const RATINGS: { value: ReviewRating; label: string; shortcut: string; icon: React.ReactNode; colorClass: string }[] = [
  {
    value: 'again',
    label: 'Again',
    shortcut: '1',
    icon: <RotateCcw size={15} />,
    colorClass: 'border-error/40 bg-error/10 text-error hover:bg-error/20 hover:border-error/60 focus-visible:ring-error',
  },
  {
    value: 'hard',
    label: 'Hard',
    shortcut: '2',
    icon: <ArrowBigDown size={15} />,
    colorClass: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/60 focus-visible:ring-amber-500',
  },
  {
    value: 'good',
    label: 'Good',
    shortcut: '3',
    icon: <ThumbsUp size={15} />,
    colorClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/60 focus-visible:ring-emerald-500',
  },
  {
    value: 'easy',
    label: 'Easy',
    shortcut: '4',
    icon: <Zap size={15} />,
    colorClass: 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 hover:border-accent-blue/60 focus-visible:ring-accent-blue',
  },
];

export function RatingControls({ onRate, disabled, isSubmitting }: RatingControlsProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled || isSubmitting) return;
      // Don't capture when user is in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const map: Record<string, ReviewRating> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      const rating = map[e.key];
      if (rating) {
        e.preventDefault();
        onRate(rating);
      }
    },
    [onRate, disabled, isSubmitting]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-2xl mx-auto"
      role="group"
      aria-label="Rate your recall"
    >
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onRate(r.value)}
          disabled={disabled || isSubmitting}
          className={`flex flex-col items-center justify-center gap-1 py-3 sm:py-4 rounded-xl border-2 font-black text-xs sm:text-sm transition-all duration-120 ease-out cursor-pointer select-none
            disabled:opacity-50 disabled:pointer-events-none
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            active:scale-95 active:shadow-none
            shadow-neo-sm hover:shadow-neo hover:-translate-x-[0.5px] hover:-translate-y-[0.5px]
            ${r.colorClass}`}
          aria-label={`Rate as ${r.label} (press ${r.shortcut})`}
        >
          {r.icon}
          <span>{r.label}</span>
          <kbd className="text-[9px] font-bold opacity-50 mt-0.5 hidden sm:inline">{r.shortcut}</kbd>
        </button>
      ))}
    </div>
  );
}
