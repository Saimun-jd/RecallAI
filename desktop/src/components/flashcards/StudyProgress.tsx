import React from 'react';

export interface StudyProgressProps {
  reviewed: number;
  total: number;
}

export function StudyProgress({ reviewed, total }: StudyProgressProps) {
  const percentage = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 w-full max-w-2xl mx-auto" role="progressbar" aria-valuenow={reviewed} aria-valuemin={0} aria-valuemax={total} aria-label={`Study progress: ${reviewed} of ${total} cards`}>
      <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden border border-border-default/50">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-black text-on-surface tabular-nums shrink-0">
        {reviewed} / {total}
      </span>
    </div>
  );
}
