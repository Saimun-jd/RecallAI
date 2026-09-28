import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight, Flame } from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid 
} from 'recharts';
import type { StudyActivityResponse } from '../../api/client';

interface ProgressSnapshotProps {
  activityData?: StudyActivityResponse | null;
}

export function ProgressSnapshot({ activityData }: ProgressSnapshotProps) {
  const chartData = activityData?.activity?.map((item) => {
    let dayLabel = item.date;
    let fullDateLabel = item.date;
    try {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        fullDateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
      }
    } catch {
      // fallback
    }
    return {
      day: dayLabel,
      date: item.date,
      fullDate: fullDateLabel,
      reviews: item.reviews_count,
      quizzes: item.quiz_attempts_count,
      total: item.reviews_count + item.quiz_attempts_count,
    };
  }) || [];

  const totalReviews = activityData?.total_reviews ?? 0;
  const activeDays = activityData?.total_active_days ?? 0;

  return (
    <div className="p-4 sm:p-5 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <BarChart3 size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-base text-on-surface">Study Consistency</h3>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Past 7 Days</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-default bg-surface-container text-xs font-black text-on-surface">
            <Flame size={13} className="text-amber-500 fill-amber-500" />
            <span>{activeDays}/7 active days</span>
          </div>
        </div>

        {/* 7-day Activity Chart */}
        <div className="h-32 w-full pt-1">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border-default/20" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  stroke="currentColor"
                  className="text-on-surface-variant"
                  tickLine={false}
                  axisLine={{ stroke: 'currentColor', className: 'text-border-default' }}
                  dy={4}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-xl border-2 border-border-default bg-surface shadow-neo text-xs space-y-1">
                          <div className="font-black text-on-surface">{data.fullDate}</div>
                          <div className="text-primary font-bold">{data.reviews} reviews completed</div>
                          {data.quizzes > 0 && (
                            <div className="text-accent-blue font-bold">{data.quizzes} quiz attempts</div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="reviews"
                  fill="var(--color-primary, #3B82F6)"
                  radius={[6, 6, 2, 2]}
                  maxBarSize={32}
                  background={{ fill: 'rgba(255, 255, 255, 0.05)', radius: 6 }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-on-surface-variant font-bold">
              No study history yet this week
            </div>
          )}
        </div>
      </div>

      {/* Footer bar: Stats on left, button on right */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3.5 mt-3.5 border-t border-border-default">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">Weekly Reviews</span>
            <span className="text-sm font-black text-on-surface">{totalReviews} {totalReviews === 1 ? 'card' : 'cards'}</span>
          </div>
          <div className="h-7 w-[1px] bg-border-default" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">Target Pace</span>
            <span className="text-sm font-black text-emerald-500">1 session/day</span>
          </div>
        </div>

        <Link
          to="/app/progress"
          className="py-2 px-3.5 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface font-extrabold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all flex items-center justify-center gap-1.5 shrink-0"
        >
          <span>View Progress</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
