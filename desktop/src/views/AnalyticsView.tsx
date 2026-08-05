import { useEffect, useState } from 'react';
import { client } from '../api/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Activity, Book, Layers, Brain, CheckCircle2, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export function AnalyticsView() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    client.getAnalytics()
      .then(data => {
        if (active) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error(err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-2">
        <AlertCircle size={32} />
        <p>Could not load analytics data.</p>
      </div>
    );
  }

  const { totals, queue, fsrs_metrics, forecast_7d } = stats;

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className={clsx("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20", colorClass)} />
      <div className="flex justify-between items-start mb-4 relative">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <div className={clsx("p-2 rounded-xl border border-white/5", colorClass.replace('bg-', 'text-').replace('/10', ''), "bg-zinc-800/50")}>
          <Icon size={18} />
        </div>
      </div>
      <div className="relative">
        <div className="text-3xl font-bold text-zinc-100">{value}</div>
        {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full flex-1 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">Analytics Overview</h2>
        <p className="text-zinc-400 mt-2">Track your learning progress and spaced repetition metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Documents" 
          value={totals.books} 
          icon={Book} 
          colorClass="bg-blue-500/10 text-blue-400"
        />
        <StatCard 
          title="Extracted Topics" 
          value={totals.topics} 
          icon={Layers} 
          colorClass="bg-indigo-500/10 text-indigo-400"
        />
        <StatCard 
          title="Total Flashcards" 
          value={totals.flashcards} 
          icon={Brain} 
          colorClass="bg-amber-500/10 text-amber-400"
        />
        <StatCard 
          title="Reviews Completed" 
          value={totals.total_reviews} 
          icon={CheckCircle2} 
          colorClass="bg-emerald-500/10 text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-emerald-500" />
            <h3 className="text-lg font-semibold text-zinc-100">7-Day Forecast</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast_7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  tick={{fill: '#71717a', fontSize: 12}} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string | number) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                />
                <YAxis 
                  stroke="#71717a" 
                  tick={{fill: '#71717a', fontSize: 12}} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                  formatter={(value: any) => [value, 'Due Cards']}
                  labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                />
                <Bar 
                  dataKey="due_count" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={20} className="text-indigo-400" />
            <h3 className="text-lg font-semibold text-zinc-100">Current Queue</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-zinc-300 font-medium">New Cards</span>
              </div>
              <span className="text-xl font-semibold text-zinc-100">{queue.new}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-zinc-300 font-medium">Learning</span>
              </div>
              <span className="text-xl font-semibold text-zinc-100">{queue.learning}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-zinc-300 font-medium">To Review</span>
              </div>
              <span className="text-xl font-semibold text-zinc-100">{queue.review}</span>
            </div>
            
            <div className="mt-4 pt-6 border-t border-zinc-800/50">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Clock size={18} /> Due Now
                </div>
                <span className="text-2xl font-bold text-emerald-400">{queue.due_now}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-100 mb-6">Algorithm Health (FSRS)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/50">
            <div className="text-sm font-medium text-zinc-400 mb-1">Average Memory Stability</div>
            <div className="text-2xl font-bold text-zinc-200">{fsrs_metrics.average_stability_days} <span className="text-sm font-normal text-zinc-500">days</span></div>
            <p className="text-xs text-zinc-500 mt-2">How long you will remember information before forgetting.</p>
          </div>
          <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/50">
            <div className="text-sm font-medium text-zinc-400 mb-1">Average Card Difficulty</div>
            <div className="text-2xl font-bold text-zinc-200">{fsrs_metrics.average_difficulty} <span className="text-sm font-normal text-zinc-500">/ 10</span></div>
            <p className="text-xs text-zinc-500 mt-2">Inherent complexity of your flashcards.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
