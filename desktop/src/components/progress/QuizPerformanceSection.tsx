import React from 'react';
import { HelpCircle, CheckCircle, XCircle, ArrowRight, Award, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type QuizPerformanceStats } from '../../api/client';
import { cn } from '../../lib/utils';

interface QuizPerformanceSectionProps {
  quizStats: QuizPerformanceStats;
}

export const QuizPerformanceSection: React.FC<QuizPerformanceSectionProps> = ({ quizStats }) => {
  const {
    total_attempts,
    completed_attempts,
    average_score,
    highest_score,
    lowest_score,
    questions_answered,
    correct_answers,
    incorrect_answers,
    accuracy_rate,
  } = quizStats;

  const hasAttempts = completed_attempts > 0;

  if (!hasAttempts) {
    return (
      <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo">
        <div className="flex items-center gap-2 pb-4 border-b-2 border-border-default mb-4">
          <HelpCircle size={18} strokeWidth={2.5} className="text-primary" />
          <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
            Quiz Assessment Performance
          </h3>
        </div>

        <div className="text-center py-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-surface-container border-2 border-border-default flex items-center justify-center mx-auto mb-3 text-on-surface-variant shadow-neo-sm">
            <Target size={24} />
          </div>
          <h4 className="text-base font-black text-on-surface mb-1">
            No Assessments Completed Yet
          </h4>
          <p className="text-xs font-semibold text-on-surface-variant mb-5">
            Complete your first AI-generated or custom quiz to track comprehension accuracy, score trends, and learning retention.
          </p>
          <Link
            to="/app/quizzes"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary text-xs font-black uppercase tracking-wide border-2 border-border-default rounded-xl shadow-neo hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Explore & Take Quizzes <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-border-default mb-6">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} strokeWidth={2.5} className="text-primary" />
          <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
            Quiz Assessment Performance
          </h3>
        </div>
        <Link
          to="/app/quizzes"
          className="text-xs font-black text-primary hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
        >
          View all quizzes <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-3.5 rounded-xl border border-border-default bg-surface-container/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Average Score
          </span>
          <span className="text-2xl font-black text-primary">
            {average_score != null ? `${average_score}%` : '—'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border-default bg-surface-container/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Accuracy Rate
          </span>
          <span className="text-2xl font-black text-on-surface">
            {accuracy_rate != null ? `${accuracy_rate}%` : '—'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border-default bg-surface-container/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Best / Lowest
          </span>
          <span className="text-lg font-black text-on-surface">
            {highest_score != null ? `${highest_score}%` : '—'}
            <span className="text-xs font-bold text-on-surface-variant ml-1">
              / {lowest_score != null ? `${lowest_score}%` : '—'}
            </span>
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-border-default bg-surface-container/40">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Completed Quizzes
          </span>
          <span className="text-2xl font-black text-on-surface">
            {completed_attempts} <span className="text-xs font-bold text-on-surface-variant">/ {total_attempts}</span>
          </span>
        </div>
      </div>

      {/* Answer ratio breakdown */}
      <div className="p-4 rounded-xl border border-border-default bg-surface-container/20 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-on-surface">Questions Answered: {questions_answered}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={13} /> {correct_answers} Correct
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <XCircle size={13} /> {incorrect_answers} Incorrect
            </span>
          </div>
        </div>

        <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden border border-border-default flex shadow-neo-sm">
          {questions_answered > 0 && (
            <>
              <div 
                style={{ width: `${Math.round((correct_answers / questions_answered) * 100)}%` }} 
                className="bg-emerald-500 border-r border-border-default" 
              />
              <div 
                style={{ width: `${Math.round((incorrect_answers / questions_answered) * 100)}%` }} 
                className="bg-rose-500" 
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
