import React from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, BookOpen, RotateCcw, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  type ReviewWorkloadStats, 
  type DocumentLearningProgress,
  type QuizPerformanceStats 
} from '../../api/client';
import { cn } from '../../lib/utils';

interface LearningGapsSectionProps {
  workload: ReviewWorkloadStats;
  documentsProgress: DocumentLearningProgress[];
  quizStats?: QuizPerformanceStats | null;
}

export const LearningGapsSection: React.FC<LearningGapsSectionProps> = ({
  workload,
  documentsProgress,
  quizStats,
}) => {
  // Find low-retention documents (less than 70% with at least 1 review)
  const lowRetentionDocs = documentsProgress.filter(
    (d) => d.total_learning_items > 0 && d.correct_rate < 70 && (d.new_items < d.total_learning_items)
  );

  // Overdue cards
  const hasOverdue = workload.overdue > 0;
  const hasDue = workload.due > 0;

  // Quiz weakness
  const hasLowQuizAccuracy = quizStats && quizStats.completed_attempts > 0 && quizStats.accuracy_rate != null && quizStats.accuracy_rate < 65;

  const hasAnyGaps = hasOverdue || (lowRetentionDocs.length > 0) || hasLowQuizAccuracy;

  return (
    <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo">
      <div className="flex items-center gap-2 pb-4 border-b-2 border-border-default mb-5">
        <AlertTriangle size={18} strokeWidth={2.5} className="text-amber-500" />
        <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
          Learning Gaps & Priority Focus Areas
        </h3>
      </div>

      {!hasAnyGaps ? (
        <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-black">All Learning Areas on Track!</h4>
            <p className="text-xs font-semibold opacity-90 mt-0.5">
              No critical memory lapses or overdue review backlogs detected. Maintain your daily study consistency to keep retention high.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Overdue Review Cards Alert */}
          {hasOverdue && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-on-surface">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 shrink-0 mt-0.5">
                  <RotateCcw size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-red-700 dark:text-red-400">
                    {workload.overdue} Spaced-Repetition Items Overdue
                  </h4>
                  <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                    Items overdue by more than 24 hours risk memory decay according to the FSRS model.
                  </p>
                </div>
              </div>
              <Link
                to="/app/review"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wide rounded-lg shadow-neo-sm transition-all shrink-0"
              >
                Review Now <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Low Quiz Accuracy Alert */}
          {hasLowQuizAccuracy && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 text-on-surface">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <HelpCircle size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400">
                    Assessment Accuracy Below Target ({quizStats.accuracy_rate}%)
                  </h4>
                  <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                    Reinforcing active recall with flashcards will help improve comprehension on question assessments.
                  </p>
                </div>
              </div>
              <Link
                to="/app/quizzes"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wide rounded-lg shadow-neo-sm transition-all shrink-0"
              >
                Practice Quizzes <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {/* Low Retention Documents */}
          {lowRetentionDocs.slice(0, 3).map((doc) => (
            <div key={doc.document_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border-default bg-surface-container/30 text-on-surface">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-surface-container border border-border-default text-primary shrink-0 mt-0.5">
                  <BookOpen size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-on-surface">
                    Retention Gap: {doc.title}
                  </h4>
                  <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                    Current recall rate is {doc.correct_rate}% across {doc.total_learning_items} tracked items.
                  </p>
                </div>
              </div>
              <Link
                to={`/documents/${doc.document_id}`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-border-default text-on-surface text-xs font-black rounded-lg transition-all shrink-0"
              >
                Study Material <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
