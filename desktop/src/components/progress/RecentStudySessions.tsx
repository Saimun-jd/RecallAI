import React from 'react';
import { History } from 'lucide-react';
import { type StudySessionSummary } from '../../api/client';
import { cn } from '../../lib/utils';

interface RecentStudySessionsProps {
  sessions: StudySessionSummary[];
}

export const RecentStudySessions: React.FC<RecentStudySessionsProps> = ({ sessions }) => {
  const hasSessions = sessions.length > 0;

  const formatDuration = (seconds?: number | null) => {
    if (seconds == null || seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo">
      <div className="flex items-center gap-2 pb-4 border-b-2 border-border-default mb-5">
        <History size={18} strokeWidth={2.5} className="text-primary" />
        <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
          Recent Study Sessions Log
        </h3>
      </div>

      {!hasSessions ? (
        <div className="text-center py-6 text-on-surface-variant font-medium text-xs">
          No past review sessions logged in this workspace yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b-2 border-border-default bg-surface-container/60 text-on-surface font-black uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Cards Reviewed</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3 text-right">Rating Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default font-medium text-on-surface">
              {sessions.map((s) => {
                const ratings = s.rating_distribution || {};
                return (
                  <tr key={s.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-on-surface">
                      {formatTimestamp(s.started_at)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider border",
                        s.status === 'completed'
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : s.status === 'active'
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                          : "bg-surface-container text-on-surface-variant border-border-default"
                      )}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {s.reviewed_items} <span className="text-on-surface-variant font-sans font-normal">/ {s.total_items}</span>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {formatDuration(s.duration_seconds)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5 font-bold text-[11px]">
                        {ratings.again ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            {ratings.again} Again
                          </span>
                        ) : null}
                        {ratings.hard ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            {ratings.hard} Hard
                          </span>
                        ) : null}
                        {ratings.good ? (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                            {ratings.good} Good
                          </span>
                        ) : null}
                        {ratings.easy ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            {ratings.easy} Easy
                          </span>
                        ) : null}
                        {!ratings.again && !ratings.hard && !ratings.good && !ratings.easy && (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
