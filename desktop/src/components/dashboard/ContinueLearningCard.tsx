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
      <div className="p-5 sm:p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-border-default">
              <NotebookPen size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-base text-on-surface">Notes & Scratchpad</h3>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Fast Recall</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Synthesize concepts, record insights, and organize ideas into interconnected markdown pages with LaTeX math and code blocks.
          </p>
        </div>

        <div className="pt-4 mt-4 border-t border-border-default">
          <Link
            to="/notes"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-border-default bg-surface text-on-surface font-extrabold text-xs sm:text-sm shadow-neo-sm hover:bg-surface-container hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <NotebookPen size={15} />
            <span>Open Notes Workspace</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <BookOpen size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-base text-on-surface">Continue Learning</h3>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Active Document</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-md border border-border-default bg-surface-container text-on-surface-variant text-[11px] font-black">
            {recentDocument.total_pages > 0 ? `${recentDocument.total_pages} pgs` : 'PDF'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border-default bg-surface-container-low/60 space-y-1.5">
          <div className="font-black text-sm text-on-surface line-clamp-1">
            {recentDocument.title}
          </div>
          <p className="text-xs text-on-surface-variant line-clamp-2">
            Pick up right where you left off. Review highlighted passages, test yourself with socratic drills, or generate new flashcard decks.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
          <Link
            to="/review"
            className="flex-1 p-2 rounded-lg border border-border-default bg-surface hover:bg-surface-container text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <BrainCircuit size={13} />
            <span>Flashcards</span>
          </Link>
          <Link
            to="/notes"
            className="flex-1 p-2 rounded-lg border border-border-default bg-surface hover:bg-surface-container text-center flex items-center justify-center gap-1.5 transition-colors"
          >
            <NotebookPen size={13} />
            <span>Open Notes</span>
          </Link>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-border-default">
        <Link
          to={`/books/${recentDocument.id}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-border-default bg-primary text-white font-extrabold text-xs sm:text-sm shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all active:translate-x-1 active:translate-y-1"
        >
          <BookOpen size={15} />
          <span>Resume Document</span>
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
