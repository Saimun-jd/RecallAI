import React from 'react';
import { Link } from 'react-router-dom';
import { Book, BrainCircuit, CheckCircle2, Layers, ArrowUpRight } from 'lucide-react';
import type { DashboardSummaryResponse } from '../../api/client';

interface KnowledgeOverviewProps {
  totalDocuments: number;
  dashboardData: DashboardSummaryResponse | null;
}

export function KnowledgeOverview({ totalDocuments, dashboardData }: KnowledgeOverviewProps) {
  const flashcardsCount = dashboardData?.flashcards?.total_cards ?? 0;
  const dueCount = dashboardData?.review_workload?.due ?? 0;
  const reviewedTodayCount = dashboardData?.today?.reviews_completed ?? 0;

  const metrics = [
    {
      label: 'Active Documents',
      value: totalDocuments,
      subtext: 'Ingested & indexed',
      icon: Book,
      path: '/documents',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Total Flashcards',
      value: flashcardsCount,
      subtext: 'Spaced repetition cards',
      icon: Layers,
      path: '/review',
      color: 'text-accent-blue',
      bg: 'bg-accent-blue/10',
    },
    {
      label: 'Due for Review',
      value: dueCount,
      subtext: dueCount > 0 ? 'Requires attention today' : 'All reviews caught up',
      icon: BrainCircuit,
      path: '/review',
      color: dueCount > 0 ? 'text-primary' : 'text-emerald-600',
      bg: dueCount > 0 ? 'bg-primary/10' : 'bg-emerald-500/10',
      highlight: dueCount > 0,
    },
    {
      label: 'Reviewed Today',
      value: reviewedTodayCount,
      subtext: 'Completions logged today',
      icon: CheckCircle2,
      path: '/app/progress',
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <section aria-labelledby="knowledge-overview-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="knowledge-overview-heading" className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
          Knowledge & Workload Overview
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.path}
              className="group p-4 sm:p-5 rounded-xl border-2 border-border-default bg-surface shadow-neo-sm hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between select-none relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.color} flex items-center justify-center border border-border-default`}>
                  <Icon size={18} strokeWidth={2.5} />
                </div>
                <ArrowUpRight
                  size={15}
                  className="text-on-surface-variant/50 group-hover:text-primary transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
                  {item.value}
                </div>
                <div className="text-xs font-extrabold text-on-surface mt-0.5">
                  {item.label}
                </div>
                <div className="text-[11px] font-medium text-on-surface-variant truncate mt-0.5">
                  {item.subtext}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
