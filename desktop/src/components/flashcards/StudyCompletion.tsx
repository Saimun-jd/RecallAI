import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RotateCcw, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '../ui/Button';
import type { ReviewSessionItem } from '../../api/client';

export interface StudyCompletionProps {
  session: ReviewSessionItem;
  setId: string;
  setTitle: string;
}

export function StudyCompletion({ session, setId, setTitle }: StudyCompletionProps) {
  const navigate = useNavigate();

  // Calculate study duration from backend timestamps
  const startTime = new Date(session.started_at).getTime();
  const endTime = session.completed_at
    ? new Date(session.completed_at).getTime()
    : Date.now();
  const durationMs = endTime - startTime;
  const durationMin = Math.floor(durationMs / 60000);
  const durationSec = Math.floor((durationMs % 60000) / 1000);

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
      <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-xs">
        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-sm text-center">
          <p className="text-2xl font-black text-primary tabular-nums">{session.reviewed_items}</p>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mt-0.5">
            Cards Studied
          </p>
        </div>
        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo-sm text-center">
          <p className="text-2xl font-black text-on-surface tabular-nums">
            {durationMin > 0 ? `${durationMin}m` : ''} {durationSec}s
          </p>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant mt-0.5">
            Duration
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button
          variant="primary"
          size="md"
          className="flex-1 justify-center gap-2"
          onClick={() => navigate(`/app/flashcards/${setId}/study`)}
        >
          <RotateCcw size={14} />
          Study Again
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="flex-1 justify-center gap-2"
          onClick={() => navigate(`/app/flashcards/${setId}`)}
        >
          <ArrowLeft size={14} />
          Back to Set
        </Button>
        <Button
          variant="outline"
          size="md"
          className="flex-1 justify-center gap-2"
          onClick={() => navigate('/app')}
        >
          <LayoutDashboard size={14} />
          Dashboard
        </Button>
      </div>
    </div>
  );
}
