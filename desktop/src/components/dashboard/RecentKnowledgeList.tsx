import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, CheckCircle2, Loader2, AlertCircle, 
  ArrowRight, Plus, ExternalLink 
} from 'lucide-react';
import type { DocumentItem } from '../../api/client';

interface RecentKnowledgeListProps {
  documents: DocumentItem[];
  totalDocuments: number;
  onUploadClick: () => void;
}

export function RecentKnowledgeList({
  documents,
  totalDocuments,
  onUploadClick,
}: RecentKnowledgeListProps) {
  const navigate = useNavigate();

  const getStatusBadge = (status: string, error?: string | null) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[11px] font-black">
            <CheckCircle2 size={12} />
            <span>Ready</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/30 bg-primary/10 text-primary text-[11px] font-black">
            <Loader2 size={12} className="animate-spin" />
            <span>Processing</span>
          </span>
        );
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 text-[11px] font-black">
            <Loader2 size={12} className="animate-spin" />
            <span>Uploading</span>
          </span>
        );
      case 'failed':
        return (
          <span
            title={error || 'Processing failed'}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-error/30 bg-error/10 text-error text-[11px] font-black"
          >
            <AlertCircle size={12} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border-default bg-surface-container text-on-surface-variant text-[11px] font-black">
            <span>{status}</span>
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-base text-on-surface">Recent Knowledge</h3>
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              {totalDocuments} document{totalDocuments === 1 ? '' : 's'} total
            </span>
          </div>
          {totalDocuments > 0 && (
            <Link
              to="/documents"
              className="text-xs font-black text-primary hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {/* List Content */}
        {documents.length === 0 ? (
          <div className="p-6 border-2 border-dashed border-border-default rounded-xl text-center space-y-3 bg-surface-container-low/40">
            <div className="w-10 h-10 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center mx-auto border border-border-default">
              <FileText size={20} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-on-surface">No documents uploaded yet</div>
              <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
                Add your textbooks or research notes to build your grounded knowledge library.
              </p>
            </div>
            <button
              type="button"
              onClick={onUploadClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-default bg-surface text-on-surface font-extrabold text-xs shadow-neo-sm hover:bg-surface-container transition-all"
            >
              <Plus size={13} />
              <span>Add PDF</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 5).map((doc) => {
              const bookId = doc.metadata?.book_id || (!isNaN(Number(doc.id)) && !doc.id.includes('-') ? Number(doc.id) : null);
              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (bookId) {
                      navigate(`/books/${bookId}`);
                    } else {
                      navigate(`/documents/${doc.id}`);
                    }
                  }}
                  className="p-3 rounded-xl border border-border-default bg-surface-container-lowest hover:bg-surface-container-low/80 transition-colors flex items-center justify-between gap-3 cursor-pointer group select-none"
                >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border-default shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs sm:text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                      {doc.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                      {doc.total_pages > 0 && <span>{doc.total_pages} pages</span>}
                      {doc.total_pages > 0 && <span>•</span>}
                      <span>Added {formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(doc.status, doc.processing_error)}
                  <ExternalLink
                    size={14}
                    className="text-on-surface-variant/40 group-hover:text-primary transition-colors"
                  />
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {totalDocuments > 0 && (
        <div className="pt-4 mt-4 border-t border-border-default">
          <Link
            to="/documents"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-border-default bg-surface text-on-surface font-bold text-xs hover:bg-surface-container transition-all"
          >
            <span>View All Documents ({totalDocuments})</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
