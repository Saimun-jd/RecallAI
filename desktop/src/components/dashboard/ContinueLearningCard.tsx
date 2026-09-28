import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ArrowRight, NotebookPen, BrainCircuit } from 'lucide-react';
import type { DocumentItem } from '../../api/client';

interface ContinueLearningCardProps {
  recentDocument?: DocumentItem | null;
}

export function ContinueLearningCard({ recentDocument }: ContinueLearningCardProps) {
  if (!recentDocument) {
    return (
      <div className="p-4 sm:p-5 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/20 shrink-0">
            <NotebookPen size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-on-surface">Notes & Scratchpad</h3>
              <span className="px-2 py-0.5 rounded-full border border-border-default bg-surface-container text-on-surface-variant text-[10px] font-black uppercase tracking-wider">
                Fast Recall
              </span>
            </div>
            <p className="text-xs text-on-surface-variant truncate max-w-xl">
              Synthesize concepts, record insights, and organize ideas into interconnected markdown pages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/notes"
            className="w-full sm:w-auto flex items-center justify-center gap-2 py-2 px-4 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface font-extrabold text-xs sm:text-sm shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <NotebookPen size={15} />
            <span>Open Notes Workspace</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  const docUrl = recentDocument.metadata?.book_id
    ? `/books/${recentDocument.metadata.book_id}`
    : (!isNaN(Number(recentDocument.id)) && !recentDocument.id.includes('-')
        ? `/books/${recentDocument.id}`
        : `/documents/${recentDocument.id}`);

  return (
    <div className="p-4 sm:p-5 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Document info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
          <BookOpen size={18} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-primary/15 text-primary border border-primary/20 shrink-0">
              Active Reading
            </span>
            <h3 className="font-black text-sm sm:text-base text-on-surface truncate">
              {recentDocument.title}
            </h3>
            <span className="px-2 py-0.5 rounded-full border border-border-default bg-surface-container text-on-surface-variant text-[11px] font-black shrink-0">
              {recentDocument.total_pages > 0 ? `${recentDocument.total_pages} pgs` : 'PDF'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant truncate max-w-2xl mt-0.5">
            Pick up right where you left off. Review highlighted passages, test yourself with socratic drills, or generate flashcards.
          </p>
        </div>
      </div>

      {/* Quick shortcuts & CTA */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
        <Link
          to="/review"
          className="py-2 px-3 rounded-xl border border-border-default bg-surface hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center gap-1.5 shadow-neo-xs hover:shadow-neo-sm hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] transition-all"
        >
          <BrainCircuit size={14} className="text-primary" />
          <span>Flashcards</span>
        </Link>
        <Link
          to="/notes"
          className="py-2 px-3 rounded-xl border border-border-default bg-surface hover:bg-surface-container text-on-surface font-extrabold text-xs flex items-center gap-1.5 shadow-neo-xs hover:shadow-neo-sm hover:-translate-x-[0.5px] hover:-translate-y-[0.5px] transition-all"
        >
          <NotebookPen size={14} className="text-accent-blue" />
          <span>Open Notes</span>
        </Link>
        <Link
          to={docUrl}
          className="py-2 px-4 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-xs sm:text-sm shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-2"
        >
          <BookOpen size={15} />
          <span>Resume Document</span>
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
