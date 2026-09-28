import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RotateCcw, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ReviewSessionItem } from '../../api/client';
import { formatDuration } from '../../utils/formatDuration';

export interface StudyCompletionProps {
  session: ReviewSessionItem;
  setId: string;
  setTitle: string;
  durationSeconds?: number | null;
  onStudyAgain?: () => void;
}

export function StudyCompletion({
  session,
  setId,
  setTitle,
  durationSeconds,
  onStudyAgain,
}: StudyCompletionProps) {
  const navigate = useNavigate();

  // Calculate and freeze study duration from active duration or session timestamps
  const durationText = useMemo(() => {
    if (durationSeconds != null && durationSeconds >= 0) {
      return formatDuration(durationSeconds);
    }
    if (session.duration_seconds != null && session.duration_seconds >= 0) {
      return formatDuration(session.duration_seconds);
    }
    if (!session.started_at) return '0s';
    const startTime = new Date(session.started_at).getTime();
    const endTime = session.completed_at
      ? new Date(session.completed_at).getTime()
      : Date.now();
    const diff = Math.max(0, Math.round((endTime - startTime) / 1000));
    return formatDuration(diff);
  }, [durationSeconds, session.duration_seconds, session.started_at, session.completed_at]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center" role="status" aria-live="polite">
      {/* Completion Icon */}
      <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 text-emerald-600 border-2 border-emerald-500/20 flex items-center justify-center shadow-neo mb-6 motion-safe:animate-[bounce-in_0.5s_ease-out]">
        <CheckCircle2 size={36} />
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-on-surface mb-2">
        Session Complete!
      </h2>
      <p className="text-sm text-on-surface-variant font-medium mb-6 max-w-sm">
        You've finished studying "{setTitle}"
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-xs sm:max-w-sm">
        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-sm text-center">
          <p className="text-2xl font-black text-primary tabular-nums">{session.reviewed_items}</p>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mt-0.5">
            Cards Studied
          </p>
        </div>
        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-sm text-center">
          <p className="text-2xl font-black text-on-surface tabular-nums">
            {durationText}
          </p>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mt-0.5">
            Duration
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
        <Button
          variant="primary"
          size="md"
          className="w-full sm:flex-1 justify-center gap-2 px-4 shadow-neo-xs hover:shadow-neo"
          onClick={() => {
            if (onStudyAgain) {
              onStudyAgain();
            } else {
              navigate(`/app/flashcards/${setId}/study`);
            }
          }}
        >
          <RotateCcw size={15} />
          <span>Study Again</span>
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="w-full sm:flex-1 justify-center gap-2 px-4 shadow-neo-xs hover:shadow-neo"
          onClick={() => navigate(`/app/flashcards/${setId}`)}
        >
          <ArrowLeft size={15} />
          <span>Back to Set</span>
        </Button>
        <Button
          variant="outline"
          size="md"
          className="w-full sm:flex-1 justify-center gap-2 px-4 shadow-neo-xs hover:shadow-neo"
          onClick={() => navigate('/app')}
        >
          <LayoutDashboard size={15} />
          <span>Dashboard</span>
        </Button>
      </div>
    </div>
  );
}
