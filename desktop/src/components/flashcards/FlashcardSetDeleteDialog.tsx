import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface FlashcardSetDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  setTitle: string;
  isDeleting?: boolean;
}

export function FlashcardSetDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  setTitle,
  isDeleting,
}: FlashcardSetDeleteDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-error" />
          Delete Flashcard Set
        </span>
      }
      maxWidth="sm"
    >
      <p className="text-sm text-on-surface font-medium leading-relaxed">
        Are you sure you want to delete{' '}
        <strong className="font-black">"{setTitle}"</strong>? This will permanently remove all cards in this set. This action cannot be undone.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} isLoading={isDeleting}>
          Delete Set
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
