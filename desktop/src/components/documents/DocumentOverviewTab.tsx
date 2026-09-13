import React from 'react';
import { 
  FileText, BookOpen, Layers, Clock, Cpu, Sparkles, 
  Brain, FileSearch, ArrowRight, Share2, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import type { DocumentItem, RelatedDocumentItem } from '../../api/client';
import { Button } from '../ui/Button';

export interface DocumentOverviewTabProps {
  document: DocumentItem;
  relatedDocuments?: RelatedDocumentItem[];
  onNavigateRelated: (id: string) => void;
  onSelectTab: (tab: string) => void;
}

export function DocumentOverviewTab({
  document,
  relatedDocuments = [],
  onNavigateRelated,
  onSelectTab,
}: DocumentOverviewTabProps) {
  const metadata = document.metadata || {};

  return (
    <div className="space-y-6">
      {/* 1. Quick Knowledge Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-1">
            <BookOpen size={14} className="text-primary" />
            <span>Pages</span>
          </div>
          <p className="text-2xl font-black text-on-surface">
            {document.total_pages || 1}
          </p>
          <span className="text-[10px] text-on-surface-variant font-medium">Extracted sheets</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-1">
            <Layers size={14} className="text-primary" />
            <span>Chunks</span>
          </div>
          <p className="text-2xl font-black text-on-surface">
            {metadata.chunk_count || 'Indexed'}
          </p>
          <span className="text-[10px] text-on-surface-variant font-medium">Semantic vectors</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-1">
            <Cpu size={14} className="text-primary" />
            <span>Embedding</span>
          </div>
          <p className="text-sm font-black text-on-surface truncate mt-1">
            {metadata.embedding_model || 'text-embedding-3'}
          </p>
          <span className="text-[10px] text-on-surface-variant font-medium">Cosine grounded</span>
        </div>

        <div className="p-4 rounded-xl border-2 border-border-default bg-surface shadow-neo">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant mb-1">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Isolation</span>
          </div>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
            Multi-Tenant
          </p>
          <span className="text-[10px] text-on-surface-variant font-medium">Zero AI training</span>
        </div>
      </div>

      {/* 2. Primary Feature Jump Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onSelectTab('summary')}
          className="p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo hover:shadow-neo-md hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-neo-sm">
              <Sparkles size={18} />
            </div>
            <h4 className="font-extrabold text-sm text-on-surface mb-1 group-hover:text-primary transition-colors">
              AI Summary & Insights
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Read executive summaries, short synopses, and key takeaway bullets.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black text-primary mt-4">
            <span>View Summary</span>
            <ArrowRight size={13} />
          </span>
        </div>

        <div
          onClick={() => onSelectTab('concepts')}
          className="p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo hover:shadow-neo-md hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-neo-sm">
              <Brain size={18} />
            </div>
            <h4 className="font-extrabold text-sm text-on-surface mb-1 group-hover:text-amber-600 transition-colors">
              Extracted Concepts
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Master core terminology and definitions mapped directly to page citations.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-600 mt-4">
            <span>Explore Concepts</span>
            <ArrowRight size={13} />
          </span>
        </div>

        <div
          onClick={() => onSelectTab('sources')}
          className="p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo hover:shadow-neo-md hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-neo-sm">
              <FileSearch size={18} />
            </div>
            <h4 className="font-extrabold text-sm text-on-surface mb-1 group-hover:text-emerald-600 transition-colors">
              Grounding Sources
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Inspect chunked excerpts and verifiable page citations powering RAG.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 mt-4">
            <span>Browse Sources</span>
            <ArrowRight size={13} />
          </span>
        </div>
      </div>

      {/* 3. Related Knowledge Section */}
      {relatedDocuments.length > 0 && (
        <div className="p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-base text-on-surface flex items-center gap-2">
                <Share2 size={16} className="text-primary" />
                Related Documents in Workspace
              </h4>
              <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
                Discovered via semantic embedding similarity across your knowledge base.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedDocuments.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onNavigateRelated(rel.id)}
                className="p-3.5 rounded-lg border border-border-default bg-surface-container-low/50 hover:bg-surface-container hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="overflow-hidden pr-3">
                  <p className="font-bold text-xs text-on-surface truncate group-hover:text-primary transition-colors">
                    {rel.title}
                  </p>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    {rel.source_type}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {Math.round(rel.similarity_score * 100)}% match
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
