import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Table, BarChart2, CheckCircle2, Calendar } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { type StudyActivityResponse } from '../../api/client';
import { cn } from '../../lib/utils';

interface StudyActivityChartProps {
  activityData: StudyActivityResponse;
}

export const StudyActivityChart: React.FC<StudyActivityChartProps> = ({ activityData }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [showTable, setShowTable] = useState(false);

  const { activity, total_active_days, total_reviews, total_quiz_attempts, start_date, end_date } = activityData;

  // Format short date for X-Axis (e.g. "9/16" or "Sep 16")
  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Format full date for tooltip
  const formatTooltipLabel = (label: any) => {
    try {
      const d = new Date(label + 'T12:00:00Z');
      return d.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return label;
    }
  };

  return (
    <div className="bg-surface-container-lowest border-2 border-border-default rounded-xl p-6 shadow-neo flex flex-col">
      {/* Top Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-border-default">
        <div>
          <div className="flex items-center gap-2">
            <Calendar size={18} strokeWidth={2.5} className="text-primary" />
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-on-surface">
              Study Consistency Over Time
            </h2>
          </div>
          <p className="text-xs font-semibold text-on-surface-variant mt-1">
            Continuous daily activity between {start_date} and {end_date}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Table / Chart view toggle */}
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-surface-container border border-border-default rounded-lg text-on-surface hover:bg-surface-container-high transition-all shadow-neo-sm"
            aria-label={showTable ? "Switch to chart view" : "Switch to accessible table view"}
          >
            {showTable ? (
              <>
                <BarChart2 size={14} /> Chart View
              </>
            ) : (
              <>
                <Table size={14} /> Table View
              </>
            )}
          </button>
        </div>
      </div>

      {/* Period Summary Pills */}
      <div className="grid grid-cols-3 gap-3 my-4 py-2 px-3 bg-surface-container/50 border border-border-default rounded-lg">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Active Days
          </span>
          <span className="text-sm sm:text-base font-black text-on-surface">
            {total_active_days} <span className="text-xs font-bold text-on-surface-variant">/ {activity.length}</span>
          </span>
        </div>
        <div className="text-center border-x border-border-default">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Reviews
          </span>
          <span className="text-sm sm:text-base font-black text-primary">
            {total_reviews}
          </span>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant block">
            Quizzes
          </span>
          <span className="text-sm sm:text-base font-black text-on-surface">
            {total_quiz_attempts}
          </span>
        </div>
      </div>

      {/* Visual Content: Accessible Table or Recharts */}
      {showTable ? (
        <div className="max-h-[350px] overflow-y-auto border border-border-default rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-container sticky top-0 border-b border-border-default font-black uppercase tracking-wider text-on-surface">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Reviews</th>
                <th className="py-2.5 px-3">Quizzes</th>
                <th className="py-2.5 px-3">Correct</th>
                <th className="py-2.5 px-3">Incorrect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default font-medium text-on-surface">
              {activity.map((day) => (
                <tr key={day.date} className="hover:bg-surface-container/40">
                  <td className="py-2 px-3 font-mono font-bold">{day.date}</td>
                  <td className="py-2 px-3">{day.reviews_count}</td>
                  <td className="py-2 px-3">{day.quiz_attempts_count}</td>
                  <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{day.correct_answers}</td>
                  <td className="py-2 px-3 text-red-600 dark:text-red-400 font-bold">{day.incorrect_answers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[320px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={activity} 
              margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
              role="img"
              aria-label="Daily study activity chart showing reviews and quizzes"
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDark ? '#334155' : '#e2e8f0'} 
                vertical={false}
                strokeWidth={1}
                opacity={isDark ? 0.4 : 0.8}
              />
              <XAxis 
                dataKey="date" 
                stroke={isDark ? '#64748b' : '#94a3b8'} 
                tick={{ fill: isDark ? '#cbd5e1' : '#475569', fontSize: 11, fontWeight: 700 }}
                tickLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                tickFormatter={formatDateLabel}
                dy={6}
              />
              <YAxis 
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
                stroke={isDark ? '#64748b' : '#94a3b8'} 
                tick={{ fill: isDark ? '#cbd5e1' : '#475569', fontSize: 11, fontWeight: 700 }}
                tickLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
              />
              <Tooltip 
                cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' }}
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  border: `2px solid ${isDark ? '#334155' : '#191b23'}`,
                  borderRadius: '10px',
                  boxShadow: isDark ? '4px 4px 0px 0px #000000' : '4px 4px 0px 0px #191b23',
                  fontWeight: 'bold',
                  padding: '10px 14px',
                }}
                labelStyle={{
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontWeight: '900',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
                labelFormatter={formatTooltipLabel}
              />
              <Legend 
                verticalAlign="top"
                height={36}
                formatter={(value: string) => (
                  <span className="text-xs font-black uppercase text-on-surface mr-4">
                    {value === 'reviews_count' ? 'Spaced Reviews' : 'Quiz Attempts'}
                  </span>
                )}
              />
              <Bar 
                name="reviews_count"
                dataKey="reviews_count" 
                fill={isDark ? '#38bdf8' : '#0284c7'} 
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar 
                name="quiz_attempts_count"
                dataKey="quiz_attempts_count" 
                fill={isDark ? '#a855f7' : '#7c3aed'} 
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
