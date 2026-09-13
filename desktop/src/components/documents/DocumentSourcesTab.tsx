import React, { useState, useMemo } from 'react';
import { FileSearch, Search, Layers, BookOpen, Hash, Copy, Check } from 'lucide-react';
import type { ChunkItemResponse } from '../../api/client';

export interface DocumentSourcesTabProps {
  documentId: string;
  chunks: ChunkItemResponse[];
  totalChunks: number;
  isLoading: boolean;
  error: string | null;
}

export function DocumentSourcesTab({
  documentId,
  chunks,
  totalChunks,
  isLoading,
  error,
}: DocumentSourcesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return chunks;
    const query = searchQuery.toLowerCase();
    return chunks.filter((c) =>
      c.content.toLowerCase().includes(query) ||
      (c.page_number && `page ${c.page_number}`.includes(query))
    );
  }, [chunks, searchQuery]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border-2 border-border-default bg-surface shadow-neo">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search within semantic chunks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-bold rounded-lg border-2 border-border-default bg-surface-container focus:bg-surface focus:outline-hidden focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-bold text-on-surface-variant">
          <Layers size={14} className="text-primary" />
          <span>
            Showing {filteredChunks.length} of {totalChunks || chunks.length} chunks
          </span>
        </div>
      </div>

      {/* Explanatory callout */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs space-y-1">
        <p className="font-extrabold text-on-surface flex items-center gap-1.5">
          <FileSearch size={14} className="text-primary" />
          Verifiable Grounding Corpus
        </p>
        <p className="text-on-surface-variant font-medium leading-relaxed">
          These semantic chunks represent the normalized textual units extracted from your document. Every AI answer and concept citation maps directly back to these chunks to prevent hallucinations.
        </p>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 rounded-xl border-2 border-border-default/60 bg-surface shadow-neo space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-surface-container-high rounded" />
                <div className="h-4 w-16 bg-surface-container-high rounded" />
              </div>
              <div className="h-4 bg-surface-container rounded w-full" />
              <div className="h-4 bg-surface-container rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border-2 border-error/30 bg-error/10 text-error text-xs font-bold shadow-neo">
          Failed to load document chunks: {error}
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="p-8 rounded-xl border-2 border-border-default bg-surface text-center shadow-neo">
          <p className="text-sm font-bold text-on-surface mb-1">No chunks match your search</p>
          <p className="text-xs text-on-surface-variant">Try clearing the search query.</p>
        </div>
      ) : (
        /* Chunk Cards List */
        <div className="space-y-4">
          {filteredChunks.map((chunk) => (
            <div
              key={chunk.id}
              className="p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo hover:shadow-neo-sm transition-all space-y-3"
            >
              {/* Chunk Header */}
              <div className="flex items-center justify-between gap-2 border-b border-border-default/60 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                  <span className="px-2 py-0.5 rounded-md bg-surface-container border border-border-default font-black text-primary">
                    Chunk #{chunk.chunk_index}
                  </span>
                  {chunk.page_number && (
                    <span className="flex items-center gap-1 text-on-surface-variant">
                      <BookOpen size={12} />
                      Page {chunk.page_number}
                    </span>
                  )}
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    ({chunk.token_count} tokens)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(chunk.id, chunk.content)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
                  title="Copy chunk text"
                >
                  {copiedId === chunk.id ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Chunk Verbatim Text */}
              <p className="text-xs sm:text-sm font-medium text-on-surface leading-relaxed whitespace-pre-line font-mono bg-surface-container-low/30 p-3 rounded-lg border border-border-default/40">
                {chunk.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
