import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Globe2, ChevronDown, Check, X, FileText, Search } from 'lucide-react';
import type { DocumentItem } from '../../api/client';
import { fetchUnifiedDocuments } from '../../utils/documentUtils';
import { cn } from '../../lib/utils';

export interface KnowledgeScopeSelectorProps {
  selectedDocumentId: string | null;
  selectedDocumentTitle?: string | null;
  onSelectScope: (documentId: string | null, documentTitle?: string) => void;
  className?: string;
}

export function KnowledgeScopeSelector({
  selectedDocumentId,
  selectedDocumentTitle,
  onSelectScope,
  className,
}: KnowledgeScopeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDocs = async () => {
      setLoading(true);
      try {
        const unified = await fetchUnifiedDocuments(100);
        if (isMounted) {
          // Keep documents that are ready or uploaded study items
          setDocuments(unified.filter((d) => d.status === 'ready' || !d.status));
        }
      } catch (err) {
        console.error('Failed to load documents for scope selector:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadDocs();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedDoc = documents.find(
    (d) => d.id === selectedDocumentId || d.metadata?.book_id?.toString() === selectedDocumentId
  );

  const displayTitle = selectedDocumentId
    ? (selectedDoc?.title || selectedDocumentTitle || 'Selected Document')
    : 'All Knowledge';

  const filteredDocs = documents.filter((doc) =>
    !searchQuery.trim() || doc.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      {/* Scope Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-border-default text-xs font-bold transition-all select-none cursor-pointer',
          selectedDocumentId
            ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/40 shadow-neo-sm'
            : 'bg-surface text-on-surface hover:bg-surface-container shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px]'
        )}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {selectedDocumentId ? (
          <BookOpen size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <Globe2 size={14} className="text-primary shrink-0" />
        )}
        <span className="truncate max-w-[200px] sm:max-w-[240px]" title={displayTitle}>
          {displayTitle}
        </span>
        {selectedDoc && selectedDoc.total_pages > 0 && (
          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-amber-500/20 text-[10px] font-mono">
            {selectedDoc.total_pages} {selectedDoc.total_pages === 1 ? 'page' : 'pages'}
          </span>
        )}
        <ChevronDown size={14} className={cn('transition-transform duration-150 shrink-0', isOpen && 'rotate-180')} />
      </button>

      {/* Quick clear button if a document is selected */}
      {selectedDocumentId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectScope(null);
          }}
          className="ml-1 p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs transition-colors inline-flex align-middle"
          title="Reset to All Knowledge"
          aria-label="Reset scope to all knowledge"
        >
          <X size={13} />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 sm:w-80 rounded-xl border-2 border-border-default bg-surface shadow-neo-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b-2 border-border-default bg-surface-container-low flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant">
              Retrieval Scope
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">
              {documents.length} ready {documents.length === 1 ? 'doc' : 'docs'}
            </span>
          </div>

          {/* Search box if 4 or more documents */}
          {documents.length >= 4 && (
            <div className="p-2 border-b border-border-default bg-surface">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Filter documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-6 py-1 text-xs rounded-md border border-border-default bg-surface-container focus:bg-surface focus:outline-hidden focus:border-primary"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="p-1.5 max-h-64 overflow-y-auto space-y-1 custom-scrollbar">
            {/* Option 1: All Knowledge */}
            <button
              type="button"
              onClick={() => {
                onSelectScope(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left group',
                !selectedDocumentId
                  ? 'bg-primary/10 border-2 border-primary/30 text-primary font-black shadow-neo-sm'
                  : 'text-on-surface hover:bg-surface-container border-2 border-transparent'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe2 size={15} className="text-primary shrink-0" />
                <div className="truncate">
                  <span className="block truncate">All Knowledge (Global)</span>
                  <span className="text-[10px] text-on-surface-variant font-normal block">
                    Searches all documents in your library
                  </span>
                </div>
              </div>
              {!selectedDocumentId && <Check size={14} className="text-primary shrink-0" />}
            </button>

            {/* Document Specific Options */}
            {loading ? (
              <div className="p-3 text-center text-xs text-on-surface-variant animate-pulse">
                Loading study documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="p-3 text-center text-xs text-on-surface-variant">
                No processed documents found in your workspace.
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-3 text-center text-xs text-on-surface-variant">
                No documents match "{searchQuery}"
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected =
                  selectedDocumentId === doc.id ||
                  doc.metadata?.book_id?.toString() === selectedDocumentId;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onSelectScope(doc.id, doc.title);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left group',
                      isSelected
                        ? 'bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-300 font-black shadow-neo-sm'
                        : 'text-on-surface hover:bg-surface-container border-2 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      <FileText size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="truncate min-w-0">
                        <span className="block truncate" title={doc.title}>
                          {doc.title}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-mono block">
                          {doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'} · {(doc.source_type || 'PDF').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-amber-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
