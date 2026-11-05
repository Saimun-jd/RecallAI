import React from 'react';
import { TrendingUp, BookOpen, BrainCircuit, HelpCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ProgressEmptyState: React.FC = () => {
  return (
    <div className="bg-surface-container-lowest border-2 border-border-default rounded-2xl p-8 sm:p-12 shadow-neo text-center max-w-2xl mx-auto my-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4 text-primary shadow-neo-sm">
        <TrendingUp size={32} strokeWidth={2.5} />
      </div>

      <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight mb-2">
        Begin Your Learning Journey
      </h2>

      <p className="text-sm font-semibold text-on-surface-variant max-w-md mx-auto mb-8">
        Your learning progress, memory retention metrics, and assessment insights will appear here as you study, review cards, and complete quizzes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
        <Link
          to="/documents"
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container shadow-neo-sm hover:-translate-y-0.5 transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-surface-container border border-border-default text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <BookOpen size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-xs text-on-surface uppercase tracking-wider">1. Add Knowledge</div>
            <div className="text-xs text-on-surface-variant font-medium truncate">Upload PDFs and study materials</div>
          </div>
          <ArrowRight size={14} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/app/flashcards"
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container shadow-neo-sm hover:-translate-y-0.5 transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-surface-container border border-border-default text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <BrainCircuit size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-xs text-on-surface uppercase tracking-wider">2. Study Cards</div>
            <div className="text-xs text-on-surface-variant font-medium truncate">Generate & flip flashcards</div>
          </div>
          <ArrowRight size={14} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/app/quizzes"
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container shadow-neo-sm hover:-translate-y-0.5 transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-surface-container border border-border-default text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <HelpCircle size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-xs text-on-surface uppercase tracking-wider">3. Take Quizzes</div>
            <div className="text-xs text-on-surface-variant font-medium truncate">Test your comprehension</div>
          </div>
          <ArrowRight size={14} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/app/review"
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container shadow-neo-sm hover:-translate-y-0.5 transition-all group"
        >
          <div className="p-2.5 rounded-lg bg-surface-container border border-border-default text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <RotateCcw size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-xs text-on-surface uppercase tracking-wider">4. Daily Review</div>
            <div className="text-xs text-on-surface-variant font-medium truncate">FSRS spaced repetition</div>
          </div>
          <ArrowRight size={14} className="text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </div>
  );
};
