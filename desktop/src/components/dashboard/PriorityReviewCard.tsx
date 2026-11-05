import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Clock, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import type { ReviewWorkloadStats, LearningStateDistribution } from '../../api/client';

interface PriorityReviewCardProps {
  workload: ReviewWorkloadStats;
  learningStates?: LearningStateDistribution;
}

export function PriorityReviewCard({ workload, learningStates }: PriorityReviewCardProps) {
  const isDue = workload.due > 0;
  const isOverdue = workload.overdue > 0;

  return (
    <div className="p-5 sm:p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <BrainCircuit size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-base text-on-surface">Daily Spaced Review</h3>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">FSRS Memory Engine</span>
            </div>
          </div>
          {isDue ? (
            <span className="px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-black text-xs">
              {workload.due} due
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>Caught Up</span>
            </span>
          )}
        </div>

        {/* Workload Stats Bar */}
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl border border-border-default bg-surface-container-low">
          <div className="text-center">
            <div className="text-lg font-black text-on-surface">{workload.due}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Due Today</div>
          </div>
          <div className="text-center border-x border-border-default">
            <div className={`text-lg font-black ${isOverdue ? 'text-error' : 'text-on-surface'}`}>
              {workload.overdue}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Overdue</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black text-on-surface">{workload.new}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">New Cards</div>
          </div>
        </div>

        {/* FSRS Learning States Progress Bar */}
        {learningStates && learningStates.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-on-surface-variant">
              <span>Memory Stages ({learningStates.total} items)</span>
              <span>{learningStates.by_state?.review || 0} mastered</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-surface-container-high border border-border-default">
              <div
                title={`Mastered: ${learningStates.by_state?.review || 0}`}
                style={{ width: `${((learningStates.by_state?.review || 0) / learningStates.total) * 100}%` }}
                className="bg-emerald-500 transition-all"
              />
              <div
                title={`Learning: ${learningStates.by_state?.learning || 0}`}
                style={{ width: `${((learningStates.by_state?.learning || 0) / learningStates.total) * 100}%` }}
                className="bg-primary transition-all"
              />
              <div
                title={`Relearning: ${learningStates.by_state?.relearning || 0}`}
                style={{ width: `${((learningStates.by_state?.relearning || 0) / learningStates.total) * 100}%` }}
                className="bg-amber-500 transition-all"
              />
              <div
                title={`New: ${learningStates.by_state?.new || 0}`}
                style={{ width: `${((learningStates.by_state?.new || 0) / learningStates.total) * 100}%` }}
                className="bg-surface-container-high transition-all"
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-on-surface-variant/80">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Mastered</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> Learning</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Relearning</span>
            </div>
          </div>
        )}

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Daily active recall trains your synapses right at the point of predicted forgetting, transforming fragile thoughts into durable knowledge.
        </p>
      </div>

      {/* Action CTA */}
      <div className="pt-4 mt-4 border-t border-border-default">
        <Link
          to="/app/review"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 border-border-default bg-primary text-white font-black text-xs sm:text-sm shadow-neo-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
        >
          <Zap size={15} />
          <span>{isDue ? `Launch Review (${workload.due} due)` : 'Practice Review Session'}</span>
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
