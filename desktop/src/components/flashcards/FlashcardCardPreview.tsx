import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { FlashcardItem } from '../../api/client';
import { MarkdownRenderer } from '../MarkdownRenderer';

export interface FlashcardCardPreviewProps {
  card: FlashcardItem;
  index: number;
}

export function FlashcardCardPreview({ card, index }: FlashcardCardPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sourceDoc = card.source_metadata?.[0];
  const sourceTitle = sourceDoc?.document_title || sourceDoc?.title;
  const sourcePage = sourceDoc?.page_number;

  return (
    <div
      className="border-2 border-border-default rounded-xl bg-surface shadow-neo-sm overflow-hidden transition-all"
      role="article"
      aria-label={`Card ${index + 1}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-container/50 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
      >
        <span className="shrink-0 w-7 h-7 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[11px] font-black">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-bold text-on-surface leading-snug line-clamp-2">
            {card.front}
          </p>
          {sourceTitle && (
            <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant font-medium">
              <FileText size={9} className="shrink-0" />
              {sourceTitle}
              {sourcePage != null && <span>· p.{sourcePage}</span>}
            </span>
          )}
        </div>
        <span className="shrink-0 text-on-surface-variant mt-0.5">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border-default/50">
          <div className="ml-10 pt-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70 mb-1 block">
              Answer
            </span>
            <div className="text-sm text-on-surface leading-relaxed prose-xs">
              <MarkdownRenderer content={card.back} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
