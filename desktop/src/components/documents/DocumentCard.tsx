import React from 'react';
import { 
  FileText, CheckCircle2, Clock, AlertCircle, Loader2, 
  Trash2, RefreshCw, ArrowRight, BookOpen, Layers 
} from 'lucide-react';
import type { DocumentItem, DocumentStatusResponse } from '../../api/client';
import { Button } from '../ui/Button';

export interface DocumentCardProps {
  document: DocumentItem;
  liveStatus?: DocumentStatusResponse;
  onOpen: (id: string) => void;
  onDeleteClick: (doc: DocumentItem) => void;
  onRetry: (id: string) => void;
}

export function DocumentCard({
  document,
  liveStatus,
  onOpen,
  onDeleteClick,
  onRetry,
}: DocumentCardProps) {
  const currentStatus = liveStatus?.status || document.status;
  const stage = liveStatus?.current_stage;
  const progress = liveStatus?.stage_progress || 0;
  const errorMessage = document.processing_error || liveStatus?.error_message;

  const isReady = currentStatus === 'ready';
  const isProcessing = currentStatus === 'processing' || currentStatus === 'uploading';
  const isFailed = currentStatus === 'failed';

  // Format relative time
  const formatTimeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / (1000 * 60));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  const getFormatBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return { label: 'PDF', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400' };
    if (t.includes('md') || t.includes('markdown')) return { label: 'MD', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400' };
    return { label: 'TXT', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400' };
  };

  const formatBadge = getFormatBadge(document.source_type);

  return (
    <div
      onClick={() => isReady && onOpen(document.id)}
      className={`group relative flex flex-col justify-between p-5 rounded-[var(--radius-large)] border-2 border-border-default bg-surface shadow-neo transition-all duration-150 ${
        isReady ? 'hover:-translate-y-1 hover:shadow-neo-md cursor-pointer' : ''
      }`}
    >
      <div>
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${formatBadge.color}`}>
              {formatBadge.label}
            </span>
            <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
              <Clock size={12} />
              {formatTimeAgo(document.created_at)}
            </span>
          </div>

          {/* Status Badge */}
          {isReady && (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/90 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <CheckCircle2 size={12} />
              Ready
            </span>
          )}
          {isProcessing && (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-full">
              <Loader2 size={12} className="animate-spin" />
              Processing
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-error bg-error/10 border border-error/30 px-2.5 py-0.5 rounded-full">
              <AlertCircle size={12} />
              Failed
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-black text-base text-on-surface line-clamp-2 leading-snug mb-2 group-hover:text-primary transition-colors">
          {document.title}
        </h3>

        {/* Metadata stats */}
        <div className="flex items-center gap-4 text-xs font-semibold text-on-surface-variant mb-4">
          {document.total_pages > 0 && (
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-primary" />
              {document.total_pages} {document.total_pages === 1 ? 'Page' : 'Pages'}
            </span>
          )}
          {document.metadata?.chunk_count && (
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-primary" />
              {document.metadata.chunk_count} Chunks
            </span>
          )}
        </div>

        {/* Processing State Bar */}
        {isProcessing && (
          <div className="p-3 mb-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-on-surface">
              <span className="truncate pr-2 capitalize">
                {stage ? stage.replace(/_/g, ' ') : 'Preparing knowledge...'}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden border border-border-default/60">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(10, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Failed State Error Banner */}
        {isFailed && (
          <div className="p-3 mb-3 rounded-xl border border-error/30 bg-error/10 text-error space-y-1">
            <p className="text-xs font-bold leading-tight">
              {errorMessage || 'Document processing could not complete.'}
            </p>
            <p className="text-[10px] text-error/80 font-medium">
              Check formatting or click retry to restart processing pipeline.
            </p>
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-border-default/60 mt-2" onClick={(e) => e.stopPropagation()}>
        {isReady && (
          <>
            <button
              type="button"
              onClick={() => onOpen(document.id)}
              className="inline-flex items-center gap-1.5 text-xs font-black text-primary hover:underline"
            >
              <BookOpen size={13} />
              <span>Open in Reader</span>
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(document);
              }}
              className="p-1.5 rounded-lg border border-transparent text-on-surface-variant hover:text-error hover:bg-error/10 hover:border-error/20 transition-all cursor-pointer"
              title="Delete document"
              aria-label={`Delete ${document.title}`}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}

        {isProcessing && (
          <span className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin text-primary" />
            Indexing in background...
          </span>
        )}

        {isFailed && (
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(document.id);
              }}
              className="text-xs h-8 px-2.5 gap-1.5 border-primary/40 text-primary"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </Button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(document);
              }}
              className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors cursor-pointer"
              title="Delete document"
              aria-label={`Delete ${document.title}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
