import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  BrainCircuit,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  RotateCcw,
} from 'lucide-react';
import type { ReviewStatistics } from '../../api/client';
import { Button } from '../ui/Button';

export interface ReviewEmptyStateProps {
  statistics: ReviewStatistics | null;
  onRefreshQueue: () => void;
  isRefreshing: boolean;
}

export function ReviewEmptyState({
  statistics,
  onRefreshQueue,
  isRefreshing,
}: ReviewEmptyStateProps) {
  const reviewedToday = statistics?.reviewed_today ?? 0;
  const totalItems = statistics?.total_items ?? 0;

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 space-y-8 animate-in fade-in zoom-in-95">
      {/* Calm Primary Banner */}
      <div className="p-8 sm:p-10 rounded-2xl border-2 border-border-default bg-surface shadow-neo text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/30 flex items-center justify-center mx-auto shadow-neo-sm">
          <ShieldCheck size={36} strokeWidth={2.5} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
            You're all caught up!
          </h1>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
            No cards are due for spaced repetition right now. The FSRS scheduler will notify you when items reach their retention threshold.
          </p>
        </div>

        {/* Lightweight Summary Metrics */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
          <div className="p-3 rounded-xl border border-border-default bg-surface-container-low">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Reviewed Today
            </span>
            <span className="text-xl font-black text-on-surface mt-0.5 block">
              {reviewedToday}
            </span>
          </div>
          <div className="p-3 rounded-xl border border-border-default bg-surface-container-low">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Items in Memory
            </span>
            <span className="text-xl font-black text-on-surface mt-0.5 block">
              {totalItems}
            </span>
          </div>
        </div>

        <div className="pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshQueue}
            isLoading={isRefreshing}
            className="gap-2 font-bold text-xs shadow-neo-xs"
          >
            <RotateCcw size={13} />
            Check for Due Cards
          </Button>
        </div>
      </div>

      {/* Recommended Secondary Actions */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-on-surface-variant px-1">
          Continue Learning
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/app/flashcards"
            className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-xs hover:shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <BrainCircuit size={16} />
              </div>
              <h3 className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">
                Flashcard Sets
              </h3>
              <p className="text-xs text-on-surface-variant leading-snug">
                Study specific card decks by document topic.
              </p>
            </div>
            <span className="text-[11px] font-black text-primary mt-3 flex items-center gap-1">
              Browse Decks →
            </span>
          </Link>

          <Link
            to="/app/quizzes"
            className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-xs hover:shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/20">
                <HelpCircle size={16} />
              </div>
              <h3 className="text-sm font-black text-on-surface group-hover:text-accent-blue transition-colors">
                Practice Quizzes
              </h3>
              <p className="text-xs text-on-surface-variant leading-snug">
                Test active comprehension with multiple-choice drills.
              </p>
            </div>
            <span className="text-[11px] font-black text-accent-blue mt-3 flex items-center gap-1">
              Take Quiz →
            </span>
          </Link>

          <Link
            to="/documents"
            className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-xs hover:shadow-neo hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <BookOpen size={16} />
              </div>
              <h3 className="text-sm font-black text-on-surface group-hover:text-amber-600 transition-colors">
                Documents
              </h3>
              <p className="text-xs text-on-surface-variant leading-snug">
                Upload new reading materials or review extracted concepts.
              </p>
            </div>
            <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
              Open Library →
            </span>
          </Link>
        </div>

        <div className="text-center pt-2">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <LayoutDashboard size={13} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
