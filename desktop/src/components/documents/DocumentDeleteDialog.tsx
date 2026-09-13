import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface DocumentDeleteDialogProps {
  isOpen: boolean;
  documentTitle: string;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
}

export function DocumentDeleteDialog({
  isOpen,
  documentTitle,
  onClose,
  onConfirmDelete,
}: DocumentDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onConfirmDelete();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.userMessage || err?.message || 'Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => !isDeleting && onClose()}
      title="Delete Document"
      maxWidth="sm"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3.5 p-3.5 rounded-xl border-2 border-error/30 bg-error/10 text-error">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-extrabold text-sm">Permanent Action</p>
            <p className="font-medium text-error/90 leading-relaxed">
              This will permanently delete <span className="font-bold underline">"{documentTitle}"</span>, including its physical file, extracted semantic chunks, AI-generated summaries, and concepts.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="text-xs font-bold text-error bg-error/10 p-2.5 rounded-lg border border-error/30">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default/70">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete Document</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
