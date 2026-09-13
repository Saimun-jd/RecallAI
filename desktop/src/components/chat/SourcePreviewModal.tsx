import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, BookOpen, Layers, Bookmark } from 'lucide-react';
import { Button } from '../ui';
import type { SourceCitation } from '../../api/client';

export interface SourcePreviewModalProps {
  isOpen: boolean;
  citation: SourceCitation | null;
  onClose: () => void;
}

export function SourcePreviewModal({
  isOpen,
  citation,
  onClose,
}: SourcePreviewModalProps) {
  const navigate = useNavigate();

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-surface border-2 border-border-default rounded-2xl shadow-neo-lg z-10 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b-2 border-border-default bg-surface-container-low flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/30 font-mono font-black text-xs flex items-center justify-center shadow-neo-sm shrink-0">
              [S{citation.source_index}]
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-sm text-on-surface truncate" title={citation.document_title}>
                {citation.document_title}
              </h3>
              <p className="text-[11px] font-mono text-on-surface-variant">
                {citation.page_number ? `Page ${citation.page_number}` : 'Document Excerpt'}
                {citation.score !== null && citation.score !== undefined && (
                  <span> · Relevance {(citation.score * 100).toFixed(0)}%</span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-default bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Close preview"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
              <Bookmark size={14} className="text-primary" />
              <span>Grounding Evidence Reference</span>
            </div>
            <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container-lowest text-xs text-on-surface font-mono leading-relaxed select-text whitespace-pre-wrap">
              {citation.document_title} (Chunk: {citation.chunk_id})
              {citation.page_number && `\nLocated on page: ${citation.page_number}`}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border-default bg-surface-container-low text-xs text-on-surface-variant flex items-start gap-2.5">
            <Layers size={16} className="text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Recall AI verifies that this answer assertion strictly originated from the retrieved semantic chunk above.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t-2 border-border-default bg-surface flex items-center justify-between shrink-0 gap-3">
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Close
          </Button>

          {citation.document_id && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                navigate(`/app/documents/${citation.document_id}`);
              }}
              className="text-xs gap-1.5"
            >
              <BookOpen size={14} />
              <span>Open Document Detail</span>
              <ExternalLink size={13} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
