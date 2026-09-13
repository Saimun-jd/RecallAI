import React, { useState } from 'react';
import { 
  Sparkles, CheckCircle2, BookOpen, RefreshCw, Loader2, 
  AlertCircle, FileText, Bookmark, Quote 
} from 'lucide-react';
import type { DocumentSummaryResponse } from '../../api/client';
import { Button } from '../ui/Button';

export interface DocumentSummaryTabProps {
  documentId: string;
  summary: DocumentSummaryResponse | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  onGenerate: (type: 'short' | 'standard' | 'detailed', force?: boolean) => Promise<void>;
}

export function DocumentSummaryTab({
  documentId,
  summary,
  isLoading,
  isGenerating,
  error,
  onGenerate,
}: DocumentSummaryTabProps) {
  const [selectedType, setSelectedType] = useState<'short' | 'standard' | 'detailed'>('standard');

  const handleTypeSwitch = async (type: 'short' | 'standard' | 'detailed') => {
    setSelectedType(type);
    await onGenerate(type, false);
  };

  const handleRegenerate = async () => {
    await onGenerate(selectedType, true);
  };

  return (
    <div className="space-y-6">
      {/* Level Selection Bar & AI Label */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border-2 border-border-default bg-surface shadow-neo">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-on-surface uppercase tracking-wider pl-1">
            Depth:
          </span>
          <div className="inline-flex rounded-lg border border-border-default bg-surface-container p-1 gap-1">
            {(['short', 'standard', 'detailed'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSwitch(type)}
                disabled={isGenerating || isLoading}
                className={`px-3 py-1 rounded-md text-xs font-bold capitalize transition-all ${
                  selectedType === type
                    ? 'bg-primary text-on-primary shadow-neo-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
            <Sparkles size={12} />
            AI-generated summary
          </span>

          {summary && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="text-xs h-8 px-2.5 gap-1.5"
            >
              <RefreshCw size={12} className={isGenerating ? 'animate-spin' : ''} />
              <span>Regenerate</span>
            </Button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading || isGenerating ? (
        <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo space-y-4 animate-pulse">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Loader2 size={16} className="animate-spin" />
            <span>{isGenerating ? 'Generating structured summary with AI...' : 'Loading summary...'}</span>
          </div>
          <div className="h-5 bg-surface-container-high rounded w-3/4" />
          <div className="h-4 bg-surface-container-high rounded w-full" />
          <div className="h-4 bg-surface-container-high rounded w-5/6" />
          <div className="h-4 bg-surface-container-high rounded w-2/3" />
          <div className="pt-4 space-y-2">
            <div className="h-4 bg-surface-container rounded w-1/2" />
            <div className="h-4 bg-surface-container rounded w-2/5" />
          </div>
        </div>
      ) : error ? (
        /* Error State */
        <div className="p-6 rounded-xl border-2 border-error/30 bg-error/10 text-error space-y-3 shadow-neo">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <h4 className="font-extrabold text-sm">Summary Unavailable</h4>
          </div>
          <p className="text-xs font-medium text-error/90 leading-relaxed">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onGenerate(selectedType, false)}
            className="border-error/40 text-error"
          >
            Try Again
          </Button>
        </div>
      ) : !summary ? (
        /* Empty State: Not generated yet */
        <div className="p-8 rounded-xl border-2 border-dashed border-border-default bg-surface-container-low/30 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border-2 border-primary/20 text-primary flex items-center justify-center shadow-neo-sm">
            <Sparkles size={22} />
          </div>
          <h4 className="font-extrabold text-base text-on-surface">
            No summary generated yet
          </h4>
          <p className="text-xs text-on-surface-variant max-w-md leading-relaxed font-medium">
            Generate an AI-powered summary to quickly understand the main thesis, core arguments, and takeaways.
          </p>
          <Button
            variant="primary"
            onClick={() => onGenerate(selectedType, false)}
            className="gap-2 mt-2"
          >
            <Sparkles size={14} />
            <span>Generate {selectedType} summary</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black">1 Credit</span>
          </Button>
        </div>
      ) : (
        /* Rendered Summary Content */
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <FileText size={14} className="text-primary" />
              Executive Summary
            </h4>
            <div className="text-sm font-medium text-on-surface leading-relaxed whitespace-pre-line">
              {summary.summary}
            </div>
          </div>

          {/* Key Takeaways */}
          {summary.key_points && summary.key_points.length > 0 && (
            <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Key Takeaways & Findings
              </h4>
              <ul className="space-y-2.5">
                {summary.key_points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm font-semibold text-on-surface">
                    <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grounding Source Citations */}
          {summary.source_references && summary.source_references.length > 0 && (
            <div className="p-6 rounded-xl border-2 border-border-default bg-surface shadow-neo space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <Quote size={14} className="text-primary" />
                Grounding Citations
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {summary.source_references.map((ref, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border-default bg-surface-container-low/50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <Bookmark size={10} className="text-primary" />
                        Citation #{ref.source_index}
                      </span>
                      {ref.page_number && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-container border border-border-default">
                          Page {ref.page_number}
                        </span>
                      )}
                    </div>
                    {ref.snippet && (
                      <p className="text-[11px] text-on-surface/90 italic line-clamp-3 font-medium">
                        "{ref.snippet}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
