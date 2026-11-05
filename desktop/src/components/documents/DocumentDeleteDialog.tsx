import React, { useState } from 'react';
import { AlertTriangle, Database, FileText, Layers, Sparkles, Trash2 } from 'lucide-react';
import { Dialog, DialogFooter } from '../ui/Dialog';
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
      const msg =
        typeof err?.userMessage === 'string'
          ? err.userMessage
          : typeof err?.message === 'string'
          ? err.message
          : typeof err?.userMessage?.message === 'string'
          ? err.userMessage.message
          : typeof err?.error?.message === 'string'
          ? err.error.message
          : 'Failed to delete document. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => !isDeleting && onClose()}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-error/10 border border-error/25 flex items-center justify-center shrink-0">
            <Trash2 size={16} className="text-error" />
          </div>
          <span className="text-base font-black text-on-surface">Delete Document</span>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Target Document Preview */}
        <div className="p-3.5 rounded-xl border border-border-default bg-surface-container-low/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Document</p>
            <p className="text-sm font-black text-on-surface truncate mt-0.5" title={documentTitle}>
              {documentTitle}
            </p>
          </div>
        </div>

        {/* Impact Warning Box */}
        <div className="p-4 rounded-xl border-2 border-error/20 bg-error/5 space-y-2.5">
          <div className="flex items-center gap-2 text-error font-extrabold text-xs tracking-wide uppercase">
            <AlertTriangle size={15} />
            <span>Permanent Action — Cannot be undone</span>
          </div>
          <p className="text-xs text-on-surface font-medium leading-relaxed">
            Deleting this document will permanently remove:
          </p>
          <ul className="text-xs text-on-surface-variant space-y-1.5 pl-1 font-medium">
            <li className="flex items-center gap-2">
              <Database size={13} className="text-error/70 shrink-0" />
              <span>Physical PDF/source file and cached pages</span>
            </li>
            <li className="flex items-center gap-2">
              <Layers size={13} className="text-error/70 shrink-0" />
              <span>Extracted semantic chunks and vector embeddings</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={13} className="text-error/70 shrink-0" />
              <span>AI-generated summaries, concepts, and linked notes</span>
            </li>
          </ul>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div className="p-3 rounded-lg border border-error/40 bg-error/10 text-error text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <DialogFooter className="mt-4 pt-4">
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
            isLoading={isDeleting}
            className="gap-2"
          >
            <Trash2 size={15} />
            <span>Delete Document</span>
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
