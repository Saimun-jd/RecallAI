import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ChevronDown, BookOpen, ExternalLink, Bookmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SourceCitation } from '../../api/client';

export interface SourceCitationsListProps {
  sources: SourceCitation[];
  onInspectCitation?: (citation: SourceCitation) => void;
  className?: string;
}

export function SourceCitationsList({
  sources,
  onInspectCitation,
  className,
}: SourceCitationsListProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className={cn('mt-4 pt-3 border-t border-border-default/60', className)}>
      {/* Toggle Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group select-none cursor-pointer py-1"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Layers size={12} />
          </div>
          <span className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
            Grounded in {sources.length} {sources.length === 1 ? 'source reference' : 'source references'}
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-surface-container text-[10px] font-mono text-on-surface-variant font-bold">
            Verified
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-on-surface-variant group-hover:text-on-surface font-semibold">
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          <ChevronDown
            size={14}
            className={cn('transition-transform duration-150', isExpanded && 'rotate-180')}
          />
        </div>
      </button>

      {/* Expanded Citations Grid */}
      {isExpanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
          {sources.map((source) => (
            <div
              key={`${source.document_id}-${source.chunk_id}-${source.source_index}`}
              className="p-3 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container-low transition-all shadow-neo-sm flex flex-col justify-between gap-2 text-left group"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-black shadow-2xs">
                    [S{source.source_index}]
                  </span>
                  {source.page_number && (
                    <span className="text-[10px] font-mono text-on-surface-variant font-bold bg-surface-container px-1.5 py-0.2 rounded border border-border-default">
                      Page {source.page_number}
                    </span>
                  )}
                </div>

                <h4
                  className="font-black text-xs text-on-surface truncate"
                  title={source.document_title}
                >
                  {source.document_title}
                </h4>

                {source.score !== null && source.score !== undefined && (
                  <p className="text-[10px] font-mono text-on-surface-variant">
                    Relevance: {(source.score * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-border-default/40">
                <button
                  type="button"
                  onClick={() => onInspectCitation && onInspectCitation(source)}
                  className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Bookmark size={11} />
                  <span>Inspect</span>
                </button>

                {source.document_id && (
                  <button
                    type="button"
                    onClick={() => navigate(`/app/documents/${source.document_id}`)}
                    className="text-[11px] font-bold text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1 cursor-pointer"
                    title="Open document in reader"
                  >
                    <BookOpen size={11} />
                    <span>View doc</span>
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
