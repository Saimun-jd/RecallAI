import React, { useState } from 'react';
import {
  BrainCircuit,
  Zap,
  Clock,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  FileText,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import type { ReviewQueueItem, ReviewSessionItem, ReviewStatistics } from '../../api/client';
import { Button } from '../ui/Button';

export interface ReviewQueueSummaryProps {
  queue: ReviewQueueItem[];
  statistics: ReviewStatistics | null;
  onStartReview: (limit: number) => void;
  activeSession: ReviewSessionItem | null;
  onResumeSession: () => void;
  onAbandonSession: () => void;
  isStarting: boolean;
  isAbandoning: boolean;
}

export function ReviewQueueSummary({
  queue,
  statistics,
  onStartReview,
  activeSession,
  onResumeSession,
  onAbandonSession,
  isStarting,
  isAbandoning,
}: ReviewQueueSummaryProps) {
  const [selectedLimit, setSelectedLimit] = useState<number>(20);

  const totalDue = statistics?.due_count ?? queue.length;
  const overdueCount = statistics?.overdue_count ?? 0;
  const reviewedToday = statistics?.reviewed_today ?? 0;
  const totalItems = statistics?.total_items ?? 0;

  const handleStartClick = () => {
    onStartReview(selectedLimit);
  };

  const formatPriority = (priority: string) => {
    switch (priority) {
      case 'overdue':
        return {
          label: 'Overdue',
          badgeClass: 'bg-error/10 text-error border-error/30',
          icon: <AlertTriangle size={11} className="shrink-0" />,
        };
      case 'due_now':
        return {
          label: 'Due Now',
          badgeClass: 'bg-primary/10 text-primary border-primary/30',
          icon: <Zap size={11} className="shrink-0" />,
        };
      case 'new':
      default:
        return {
          label: 'New Card',
          badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
          icon: <Sparkles size={11} className="shrink-0" />,
        };
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Active Session Resumption Banner */}
      {activeSession && activeSession.status === 'active' && (
        <div className="p-4 sm:p-5 rounded-2xl border-2 border-primary/40 bg-primary/5 shadow-neo flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center border-2 border-border-default shadow-neo-sm shrink-0">
              <RotateCcw size={20} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-on-surface">Unfinished Session in Progress</span>
                <span className="px-2 py-0.5 rounded-full bg-primary text-white font-extrabold text-[10px]">
                  {activeSession.reviewed_items} / {activeSession.total_items}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                You have an active review session from {new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Would you like to resume where you left off?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onAbandonSession}
              isLoading={isAbandoning}
              className="text-xs font-bold"
            >
              Abandon
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onResumeSession}
              className="text-xs font-black shadow-neo-sm"
            >
              <Play size={14} className="fill-current" />
              Resume Session
            </Button>
          </div>
        </div>
      )}

      {/* Spaced Repetition Overview Header Card */}
      <div className="p-6 sm:p-8 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <BrainCircuit size={18} strokeWidth={2.5} />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Daily Spaced Review
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              The backend FSRS memory engine schedules cards at the optimal moment of predicted decay.
            </p>
          </div>

          {/* Quick Start Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center bg-surface-container-low border-2 border-border-default rounded-xl p-1 gap-1">
              <span className="text-[11px] font-bold text-on-surface-variant px-2 uppercase tracking-wider">
                Batch:
              </span>
              {[10, 20, 50].map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => setSelectedLimit(limit)}
                  className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all ${
                    selectedLimit === limit
                      ? 'bg-primary text-white shadow-neo-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {limit}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleStartClick}
              isLoading={isStarting}
              disabled={queue.length === 0}
              className="gap-2 font-black text-sm shadow-neo px-6"
            >
              <Play size={16} className="fill-current" />
              <span>Start Review ({Math.min(selectedLimit, totalDue)})</span>
            </Button>
          </div>
        </div>

        {/* 4 Stat Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl border border-border-default bg-surface-container-low">
            <div className="flex items-center justify-between text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
              <span>Due Now</span>
              <Clock size={13} className="text-primary" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-on-surface mt-1">
              {totalDue}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Scheduled for review</p>
          </div>

          <div className="p-4 rounded-xl border border-border-default bg-surface-container-low">
            <div className="flex items-center justify-between text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
              <span>Overdue</span>
              <AlertTriangle size={13} className={overdueCount > 0 ? 'text-error' : 'text-on-surface-variant'} />
            </div>
            <div className={`text-2xl sm:text-3xl font-black mt-1 ${overdueCount > 0 ? 'text-error' : 'text-on-surface'}`}>
              {overdueCount}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">High recall priority</p>
          </div>

          <div className="p-4 rounded-xl border border-border-default bg-surface-container-low">
            <div className="flex items-center justify-between text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
              <span>Reviewed Today</span>
              <TrendingUp size={13} className="text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {reviewedToday}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Completed today</p>
          </div>

          <div className="p-4 rounded-xl border border-border-default bg-surface-container-low">
            <div className="flex items-center justify-between text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
              <span>Tracked Items</span>
              <Layers size={13} className="text-on-surface-variant" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-on-surface mt-1">
              {totalItems}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">In memory network</p>
          </div>
        </div>
      </div>

      {/* Queue Item Preview List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span>Upcoming Queue</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold">
              {queue.length} items ready
            </span>
          </h2>
          <span className="text-[11px] text-on-surface-variant font-medium">
            Prioritized by overdue urgency
          </span>
        </div>

        <div className="divide-y divide-border-default/50 border-2 border-border-default rounded-2xl bg-surface shadow-neo overflow-hidden">
          {queue.map((item, idx) => {
            const priorityInfo = formatPriority(item.priority_group);
            const isFlashcard = item.content_type === 'flashcard';
            const sourceDocTitle = item.source_reference?.document_title || item.source_reference?.title;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-surface-container-low/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="font-mono text-xs font-bold text-on-surface-variant/70 shrink-0 w-6 pt-0.5">
                    #{idx + 1}
                  </span>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${priorityInfo.badgeClass}`}
                      >
                        {priorityInfo.icon}
                        <span>{priorityInfo.label}</span>
                      </span>

                      {/* Content Type Badge */}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border border-border-default/60 bg-surface-container-low text-on-surface-variant">
                        {isFlashcard ? <BrainCircuit size={10} /> : <HelpCircle size={10} />}
                        <span>{isFlashcard ? 'Flashcard' : 'Quiz Question'}</span>
                      </span>

                      {/* Source Document Reference */}
                      {sourceDocTitle && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant/80 font-medium truncate max-w-[200px]">
                          <FileText size={10} className="shrink-0 opacity-60" />
                          <span className="truncate">{sourceDocTitle}</span>
                        </span>
                      )}
                    </div>

                    {/* Question / Prompt Preview */}
                    <p className="text-sm font-bold text-on-surface line-clamp-2 leading-snug">
                      {item.front || 'Review Prompt'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartClick}
                  className="shrink-0 text-xs font-black self-center shadow-neo-xs hidden sm:flex"
                >
                  Review
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
