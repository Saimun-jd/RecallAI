import React from 'react';
import { Brain, Award } from 'lucide-react';
import { 
  type LearningStateDistribution, 
  type ReviewDetailedStats 
} from '../../api/client';
import { cn } from '../../lib/utils';

interface RetentionAndStatesSectionProps {
  learningStates: LearningStateDistribution;
  reviewStats?: ReviewDetailedStats | null;
}

export const RetentionAndStatesSection: React.FC<RetentionAndStatesSectionProps> = ({
  learningStates,
  reviewStats,
}) => {
  const { total, by_state } = learningStates;
  const newCount = by_state.new || 0;
  const learningCount = by_state.learning || 0;
  const reviewCount = by_state.review || 0;
  const relearningCount = by_state.relearning || 0;

  const totalSafe = total > 0 ? total : 1;
  const pctNew = Math.round((newCount / totalSafe) * 100);
  const pctLearning = Math.round((learningCount / totalSafe) * 100);
  const pctReview = Math.round((reviewCount / totalSafe) * 100);
  const pctRelearning = Math.round((relearningCount / totalSafe) * 100);

  // Ratings breakdown
  const ratings = reviewStats?.ratings || {};
  const totalReviews = reviewStats?.total_reviews || 0;
  const correctRate = reviewStats?.correct_rate || 0;
  const avgPerDay = reviewStats?.average_reviews_per_active_day || 0;

  const ratingOrder = [
    { key: 'again', label: 'Again (1)', color: 'bg-rose-500', textColor: 'text-rose-600 dark:text-rose-400' },
    { key: 'hard', label: 'Hard (2)', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
    { key: 'good', label: 'Good (3)', color: 'bg-sky-500', textColor: 'text-sky-600 dark:text-sky-400' },
    { key: 'easy', label: 'Easy (4)', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Card A: FSRS Memory States */}
      <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 pb-4 border-b-2 border-border-default mb-5">
            <div className="flex items-center gap-2">
              <Brain size={18} strokeWidth={2.5} className="text-primary" />
              <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
                Knowledge Maturity (FSRS)
              </h3>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-surface-container border border-border-default text-on-surface">
              {total} Total Items
            </span>
          </div>

          <p className="text-xs font-semibold text-on-surface-variant mb-4">
            How your tracked knowledge progresses through the FSRS spaced repetition memory states:
          </p>

          {/* Segmented Progress Bar */}
          <div className="h-4 border-2 border-border-default rounded-full overflow-hidden flex bg-surface-container shadow-neo-sm mb-6">
            {newCount > 0 && (
              <div 
                style={{ width: `${pctNew}%` }} 
                className="bg-slate-400 dark:bg-slate-600 border-r border-border-default"
                title={`New: ${newCount} (${pctNew}%)`}
              />
            )}
            {learningCount > 0 && (
              <div 
                style={{ width: `${pctLearning}%` }} 
                className="bg-amber-500 border-r border-border-default"
                title={`Learning: ${learningCount} (${pctLearning}%)`}
              />
            )}
            {reviewCount > 0 && (
              <div 
                style={{ width: `${pctReview}%` }} 
                className="bg-emerald-500 border-r border-border-default"
                title={`Mastered/Review: ${reviewCount} (${pctReview}%)`}
              />
            )}
            {relearningCount > 0 && (
              <div 
                style={{ width: `${pctRelearning}%` }} 
                className="bg-rose-500"
                title={`Relearning: ${relearningCount} (${pctRelearning}%)`}
              />
            )}
          </div>

          {/* Breakdown Items */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border-default bg-surface-container/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0" />
                  New
                </span>
                <span className="text-xs font-black text-on-surface">{newCount}</span>
              </div>
              <span className="text-[11px] text-on-surface-variant">Unreviewed material</span>
            </div>

            <div className="p-3 rounded-lg border border-border-default bg-surface-container/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  Learning
                </span>
                <span className="text-xs font-black text-on-surface">{learningCount}</span>
              </div>
              <span className="text-[11px] text-on-surface-variant">Forming initial recall</span>
            </div>

            <div className="p-3 rounded-lg border border-border-default bg-surface-container/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  Review
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{reviewCount}</span>
              </div>
              <span className="text-[11px] text-on-surface-variant">Graduated to long-term memory</span>
            </div>

            <div className="p-3 rounded-lg border border-border-default bg-surface-container/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  Relearning
                </span>
                <span className="text-xs font-black text-rose-600 dark:text-rose-400">{relearningCount}</span>
              </div>
              <span className="text-[11px] text-on-surface-variant">Lapsed memory reinforcement</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-border-default flex items-center justify-between text-xs text-on-surface-variant font-bold">
          <span>Long-term Retention Progress:</span>
          <span className="text-sm font-black text-on-surface">{pctReview}% Mastered</span>
        </div>
      </div>

      {/* Card B: Review Ratings & Retention Performance */}
      <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 pb-4 border-b-2 border-border-default mb-5">
            <div className="flex items-center gap-2">
              <Award size={18} strokeWidth={2.5} className="text-primary" />
              <h3 className="text-base font-black uppercase tracking-wide text-on-surface">
                Retention & Rating Distribution
              </h3>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary">
              {correctRate}% Success Rate
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-lg border border-border-default bg-surface-container/40">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
                Total Reviews Logged
              </span>
              <span className="text-xl font-black text-on-surface">{totalReviews}</span>
            </div>
            <div className="p-3 rounded-lg border border-border-default bg-surface-container/40">
              <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
                Pace per Active Day
              </span>
              <span className="text-xl font-black text-on-surface">{avgPerDay} cards</span>
            </div>
          </div>

          <div className="space-y-3">
            {ratingOrder.map((r) => {
              const item = ratings[r.key] || { count: 0, percentage: 0 };
              return (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-on-surface">{r.label}</span>
                    <span className={cn("font-mono", r.textColor)}>
                      {item.count} <span className="text-on-surface-variant font-sans">({item.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden border border-border-default/60">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-300", r.color)}
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-border-default flex items-center justify-between text-xs text-on-surface-variant font-semibold">
          <span>Evaluated across all historical study reviews</span>
          <span className="font-bold text-on-surface">{reviewStats?.reviewed_today || 0} reviewed in 24h</span>
        </div>
      </div>
    </div>
  );
};
