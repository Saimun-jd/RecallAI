import React from 'react';
import { RefreshCw, RotateCcw, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export type ActivityTimeRange = '7d' | '30d' | '90d';

interface ProgressHeaderProps {
  selectedRange: ActivityTimeRange;
  onRangeChange: (range: ActivityTimeRange) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  dueCount?: number;
}

export const ProgressHeader: React.FC<ProgressHeaderProps> = ({
  selectedRange,
  onRangeChange,
  onRefresh,
  isRefreshing = false,
  dueCount = 0,
}) => {
  const ranges: { key: ActivityTimeRange; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-2 border-border-default">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary shadow-neo-sm">
            <TrendingUp size={22} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-on-surface tracking-tight">
            Learning Progress
          </h1>
        </div>
        <p className="text-sm font-semibold text-on-surface-variant max-w-2xl pl-1 border-l-2 border-primary/40 ml-2 py-0.5">
          Real study consistency, memory retention, quiz comprehension, and knowledge mastery across your workspace.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Time range selector */}
        <div 
          className="flex items-center bg-surface-container border-2 border-border-default rounded-xl p-1 shadow-neo-sm"
          role="group"
          aria-label="Activity date range filter"
        >
          {ranges.map((r) => {
            const isActive = selectedRange === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => onRangeChange(r.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-black rounded-lg transition-all select-none",
                  isActive
                    ? "bg-primary text-on-primary shadow-neo-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                )}
                aria-pressed={isActive}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 bg-surface-container-lowest border-2 border-border-default rounded-xl text-on-surface hover:bg-surface-container shadow-neo-sm transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
          title="Refresh analytics data"
          aria-label="Refresh analytics data"
        >
          <RefreshCw size={18} className={cn(isRefreshing && "animate-spin text-primary")} />
        </button>

        {/* Due cards CTA shortcut */}
        {dueCount > 0 && (
          <Link
            to="/app/review"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-xs font-black uppercase tracking-wide border-2 border-border-default rounded-xl shadow-neo transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
          >
            <RotateCcw size={15} strokeWidth={2.5} />
            Review {dueCount} Due
          </Link>
        )}
      </div>
    </div>
  );
};
