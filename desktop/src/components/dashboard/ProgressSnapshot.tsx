import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight, Flame } from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import type { StudyActivityResponse } from '../../api/client';

interface ProgressSnapshotProps {
  activityData?: StudyActivityResponse | null;
}

export function ProgressSnapshot({ activityData }: ProgressSnapshotProps) {
  const chartData = activityData?.activity?.map((item) => {
    // Format date e.g. "Sep 12" or "09/12"
    let shortDate = item.date;
    try {
      const parts = item.date.split('-');
      if (parts.length === 3) {
        shortDate = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      }
    } catch {
      // fallback
    }
    return {
      date: shortDate,
      fullDate: item.date,
      reviews: item.reviews_count,
      quizzes: item.quiz_attempts_count,
      total: item.reviews_count + item.quiz_attempts_count,
    };
  }) || [];

  const totalReviews = activityData?.total_reviews ?? 0;
  const activeDays = activityData?.total_active_days ?? 0;

  return (
    <div className="p-5 sm:p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
              <BarChart3 size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-base text-on-surface">Study Consistency</h3>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Past 7 Days</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border-default bg-surface-container text-xs font-black text-on-surface">
            <Flame size={13} className="text-amber-500 fill-amber-500" />
            <span>{activeDays}/7 active days</span>
          </div>
        </div>

        {/* 7-day Activity Chart */}
        <div className="h-44 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border-default/40" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  stroke="currentColor"
                  className="text-on-surface-variant"
                  tickLine={false}
                  axisLine={{ stroke: 'currentColor', className: 'text-border-default' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  stroke="currentColor"
                  className="text-on-surface-variant"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-xl border-2 border-border-default bg-surface shadow-neo-sm text-xs space-y-1">
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
                  fill="var(--color-primary, #003594)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-on-surface-variant font-bold">
              No study history yet this week
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
          <span>Total reviews this week: <strong className="text-on-surface font-extrabold">{totalReviews}</strong></span>
          <span className="text-[11px] font-bold">Daily target: 1 session</span>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-border-default">
        <Link
          to="/app/progress"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-border-default bg-surface text-on-surface font-bold text-xs hover:bg-surface-container transition-all"
        >
          <span>View Learning Progress</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
