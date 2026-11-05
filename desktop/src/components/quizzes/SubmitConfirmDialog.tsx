import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface SubmitConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalQuestions: number;
  answeredCount: number;
  isSubmitting: boolean;
}

export function SubmitConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  totalQuestions,
  answeredCount,
  isSubmitting,
}: SubmitConfirmDialogProps) {
  const unansweredCount = totalQuestions - answeredCount;
  const hasUnanswered = unansweredCount > 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Submit Assessment?"
    >
      <div className="space-y-4">
        {hasUnanswered ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed font-semibold">
              <p className="font-bold">You have unanswered questions!</p>
              <p>
                You have answered <span className="font-black text-on-surface">{answeredCount}</span> of{' '}
                <span className="font-black text-on-surface">{totalQuestions}</span> questions. Any unanswered questions will be scored as incorrect.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
            <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed font-semibold">
              <p className="font-bold">All questions answered!</p>
              <p>
                You have completed all <span className="font-black text-on-surface">{totalQuestions}</span> questions in this assessment.
              </p>
            </div>
          </div>
        )}

        {/* Stats breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border-2 border-border-default bg-surface text-center">
            <p className="text-xl font-black text-primary tabular-nums">{answeredCount}</p>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">
              Answered
            </p>
          </div>
          <div className="p-3 rounded-xl border-2 border-border-default bg-surface text-center">
            <p
              className={`text-xl font-black tabular-nums ${
                hasUnanswered ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
              }`}
            >
              {unansweredCount}
            </p>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">
              Unanswered
            </p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
          {hasUnanswered ? 'Review Questions' : 'Go Back'}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onConfirm}
          isLoading={isSubmitting}
          className="bg-primary hover:bg-primary/90 text-on-primary font-black"
        >
          Submit for Grading
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
