import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface QuizDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  quizTitle: string;
  isDeleting: boolean;
}

export function QuizDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  quizTitle,
  isDeleting,
}: QuizDeleteDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete Assessment Quiz?"
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-error/10 border-2 border-error/20 text-error">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold">This action cannot be undone.</p>
            <p className="opacity-90 leading-relaxed">
              Are you sure you want to delete <span className="font-black text-on-surface">"{quizTitle}"</span>?
              All questions and associated attempt records will be permanently removed.
            </p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" size="md" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="md"
          onClick={onConfirm}
          isLoading={isDeleting}
        >
          Delete Quiz
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
