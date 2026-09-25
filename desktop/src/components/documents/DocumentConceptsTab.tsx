import React, { useState, useMemo } from 'react';
import { 
  Brain, Search, Sparkles, RefreshCw, AlertCircle, 
  Bookmark 
} from 'lucide-react';
import type { ConceptItemResponse } from '../../api/client';
import { Button } from '../ui/Button';

export interface DocumentConceptsTabProps {
  documentId: string;
  concepts: ConceptItemResponse[];
  isLoading: boolean;
  isExtracting: boolean;
  error: string | null;
  onExtract: (force?: boolean) => Promise<void>;
}

export function DocumentConceptsTab({
  documentId: _documentId,
  concepts,
  isLoading,
  isExtracting,
  error,
  onExtract,
}: DocumentConceptsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const filteredConcepts = useMemo(() => {
    return concepts.filter((c) => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesImportance = 
        importanceFilter === 'all' || c.importance === importanceFilter;
      return matchesSearch && matchesImportance;
    });
  }, [concepts, searchQuery, importanceFilter]);

  const getImportanceBadge = (importance: 'high' | 'medium' | 'low') => {
    switch (importance) {
      case 'high':
        return { label: 'High Priority', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400' };
      case 'medium':
        return { label: 'Medium', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400' };
      case 'low':
        return { label: 'Supplemental', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter & Action Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border-2 border-border-default bg-surface shadow-neo">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-bold rounded-lg border-2 border-border-default bg-surface-container focus:bg-surface focus:outline-hidden focus:border-primary transition-all"
            />
          </div>

          {/* Importance Filter */}
          <div className="inline-flex rounded-lg border border-border-default bg-surface-container p-1 gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setImportanceFilter(lvl)}
                className={`px-2.5 py-1 rounded text-xs font-bold capitalize transition-all ${
                  importanceFilter === lvl
                    ? 'bg-primary text-on-primary shadow-neo-sm font-black'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <span className="text-xs font-bold text-on-surface-variant">
            {filteredConcepts.length} {filteredConcepts.length === 1 ? 'Concept' : 'Concepts'}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onExtract(true)}
            disabled={isExtracting}
            className="text-xs h-8 px-2.5 gap-1.5"
          >
            <RefreshCw size={12} className={isExtracting ? 'animate-spin' : ''} />
            <span>{concepts.length > 0 ? 'Re-extract' : 'Extract Concepts'}</span>
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading || isExtracting ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl border-2 border-border-default/60 bg-surface shadow-neo space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-1/2 bg-surface-container-high rounded" />
                <div className="h-5 w-16 bg-surface-container-high rounded-full" />
              </div>
              <div className="h-4 w-full bg-surface-container rounded" />
              <div className="h-4 w-4/5 bg-surface-container rounded" />
              <div className="h-4 w-1/3 bg-surface-container rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State */
        <div className="p-6 rounded-xl border-2 border-error/30 bg-error/10 text-error space-y-3 shadow-neo">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <h4 className="font-extrabold text-sm">Concept Extraction Error</h4>
          </div>
          <p className="text-xs font-medium text-error/90 leading-relaxed">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExtract(false)}
            className="border-error/40 text-error"
          >
            Try Again
          </Button>
        </div>
      ) : concepts.length === 0 ? (
        /* Empty State: Not extracted yet */
        <div className="p-8 rounded-xl border-2 border-dashed border-border-default bg-surface-container-low/30 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border-2 border-amber-500/20 text-amber-600 flex items-center justify-center shadow-neo-sm">
            <Brain size={22} />
          </div>
          <h4 className="font-extrabold text-base text-on-surface">
            No concepts extracted yet
          </h4>
          <p className="text-xs text-on-surface-variant max-w-md leading-relaxed font-medium">
            Extract high-yield atomic concepts to isolate core definitions, key terminology, and foundational ideas from this document.
          </p>
          <Button
            variant="primary"
            onClick={() => onExtract(false)}
            className="gap-2 mt-2"
          >
            <Sparkles size={14} />
            <span>Extract Key Concepts</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black">1 Credit</span>
          </Button>
        </div>
      ) : filteredConcepts.length === 0 ? (
        /* Zero search matches */
        <div className="p-8 rounded-xl border-2 border-border-default bg-surface text-center shadow-neo">
          <p className="text-sm font-bold text-on-surface mb-1">No concepts found</p>
          <p className="text-xs text-on-surface-variant">Try adjusting your search query or importance filter.</p>
        </div>
      ) : (
        /* Concept Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredConcepts.map((concept) => {
            const badge = getImportanceBadge(concept.importance);

            return (
              <div
                key={concept.id}
                className="p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo hover:shadow-neo-md transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-black text-sm text-on-surface leading-tight">
                      {concept.name}
                    </h4>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                    {concept.description}
                  </p>
                </div>

                {/* Source citations */}
                {concept.source_references && concept.source_references.length > 0 && (
                  <div className="pt-2 border-t border-border-default/60 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-on-surface-variant mr-1">
                      Cited in:
                    </span>
                    {concept.source_references.map((ref, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container border border-border-default text-on-surface"
                      >
                        <Bookmark size={9} className="text-primary" />
                        {ref.page_number ? `Page ${ref.page_number}` : `Citation #${ref.source_index}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
