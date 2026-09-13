import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Globe2, ChevronDown, Check, X, FileText } from 'lucide-react';
import { client, type DocumentItem } from '../../api/client';
import { cn } from '../../lib/utils';

export interface KnowledgeScopeSelectorProps {
  selectedDocumentId: string | null;
  onSelectScope: (documentId: string | null, documentTitle?: string) => void;
  className?: string;
}

export function KnowledgeScopeSelector({
  selectedDocumentId,
  onSelectScope,
  className,
}: KnowledgeScopeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadDocs = async () => {
      setLoading(true);
      try {
        const resp = await client.getDocuments(50, 0, 'ready');
        if (isMounted) {
          setDocuments(resp.documents || []);
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

  const selectedDoc = documents.find((d) => d.id === selectedDocumentId);

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
        <span className="truncate max-w-[200px] sm:max-w-[240px]">
          {selectedDoc ? selectedDoc.title : 'All Knowledge'}
        </span>
        {selectedDoc && (
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

          <div className="p-1.5 max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
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
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocumentId === doc.id;
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
                          {doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'} · {doc.source_type.toUpperCase()}
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
