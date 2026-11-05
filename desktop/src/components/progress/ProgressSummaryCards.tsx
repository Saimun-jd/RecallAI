import React from 'react';
import { RotateCcw, Calendar, CheckCircle, Brain, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type DashboardSummaryResponse } from '../../api/client';
import { cn } from '../../lib/utils';

interface ProgressSummaryCardsProps {
  summary: DashboardSummaryResponse;
}

export const ProgressSummaryCards: React.FC<ProgressSummaryCardsProps> = ({ summary }) => {
  const { review_workload, today, quizzes, flashcards } = summary;
  const isDue = review_workload.due > 0;
  const isOverdue = review_workload.overdue > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. Review Workload Card */}
      <div className={cn(
        "bg-surface-container-lowest border-2 rounded-xl p-5 shadow-neo flex flex-col justify-between transition-all",
        isOverdue ? "border-red-500/60" : "border-border-default"
      )}>
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
              Review Workload
            </span>
            <div className="p-2 rounded-lg bg-surface-container border border-border-default text-primary">
              <RotateCcw size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-on-surface">
              {review_workload.due}
            </span>
            <span className="text-xs font-bold text-on-surface-variant">
              due now
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {isOverdue && (
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                {review_workload.overdue} overdue
              </span>
            )}
            <span className="text-[11px] font-bold text-on-surface-variant">
              {review_workload.new} new unreviewed
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border-default/60">
          {isDue ? (
            <Link
              to="/app/review"
              className="inline-flex items-center gap-1.5 text-xs font-black text-primary hover:underline"
            >
              Start daily review <ArrowRight size={14} />
            </Link>
          ) : (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle size={13} /> Queue up to date
            </span>
          )}
        </div>
      </div>

      {/* 2. Today's Activity Card */}
      <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-5 shadow-neo flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
              Today's Activity
            </span>
            <div className="p-2 rounded-lg bg-surface-container border border-border-default text-primary">
              <Calendar size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-on-surface">
              {today.reviews_completed + today.quiz_attempts}
            </span>
            <span className="text-xs font-bold text-on-surface-variant">
              actions
            </span>
          </div>

          <p className="text-xs font-bold text-on-surface-variant mt-2">
            {today.reviews_completed} reviews · {today.quiz_attempts} quizzes completed today
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-border-default/60">
          <span className="text-xs font-semibold text-on-surface-variant">
            {today.reviews_completed > 0 ? "Daily consistency logged" : "No study sessions yet today"}
          </span>
        </div>
      </div>

      {/* 3. Quiz Assessment Performance */}
      <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-5 shadow-neo flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
              Quiz Accuracy
            </span>
            <div className="p-2 rounded-lg bg-surface-container border border-border-default text-primary">
              <CheckCircle size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-on-surface">
              {quizzes.accuracy_rate != null ? `${quizzes.accuracy_rate}%` : '—'}
            </span>
            {quizzes.accuracy_rate != null && (
              <span className="text-xs font-bold text-on-surface-variant">
                accuracy
              </span>
            )}
          </div>

          <p className="text-xs font-bold text-on-surface-variant mt-2">
            {quizzes.completed_attempts > 0
              ? `${quizzes.completed_attempts} of ${quizzes.total_attempts} attempts completed`
              : 'No quizzes taken yet'}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-border-default/60">
          {quizzes.completed_attempts > 0 ? (
            <span className="text-xs font-semibold text-on-surface-variant">
              Avg score: {quizzes.average_score != null ? `${quizzes.average_score}%` : '—'}
            </span>
          ) : (
            <Link to="/app/quizzes" className="text-xs font-black text-primary hover:underline inline-flex items-center gap-1">
              Take a quiz <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* 4. Tracked Knowledge Card */}
      <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-5 shadow-neo flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
              Tracked Knowledge
            </span>
            <div className="p-2 rounded-lg bg-surface-container border border-border-default text-primary">
              <Brain size={16} strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-on-surface">
              {flashcards.total_cards}
            </span>
            <span className="text-xs font-bold text-on-surface-variant">
              flashcards
            </span>
          </div>

          <p className="text-xs font-bold text-on-surface-variant mt-2">
            {review_workload.total_active} active spaced-repetition items
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-border-default/60">
          <span className="text-xs font-semibold text-on-surface-variant">
            {flashcards.cards_in_review_state} graduated to long-term memory
          </span>
        </div>
      </div>
    </div>
  );
};
