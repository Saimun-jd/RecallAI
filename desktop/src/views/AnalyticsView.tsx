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
      <div className="flex items-center justify-center h-full bg-surface">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-blue"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full bg-surface text-on-surface-variant flex-col gap-2">
        <AlertCircle size={32} strokeWidth={1.5} />
        <p>Could not load analytics data.</p>
      </div>
    );
  }

  const { totals, queue, fsrs_metrics, forecast_7d } = stats;

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] p-6 shadow-[var(--shadow-default)] relative overflow-hidden group hover:border-border-hover hover:shadow-[var(--shadow-md)] transition-all duration-200">
      <div className={clsx("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20", colorClass)} />
      <div className="flex justify-between items-start mb-4 relative">
        <h3 className="text-sm font-medium text-on-surface-variant">{title}</h3>
        <div className={clsx("p-2 rounded-[var(--radius-standard)] border border-outline-variant", colorClass.replace('bg-', 'text-').replace('/10', ''), "bg-surface-container")}>
          <Icon size={18} strokeWidth={1.5} />
        </div>
      </div>
      <div className="relative">
        <div className="text-3xl font-bold text-primary">{value}</div>
        {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto w-full flex-1 overflow-y-auto bg-surface">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold text-primary tracking-tight">Analytics Overview</h2>
        <p className="text-on-surface-variant mt-2">Track your learning progress and spaced repetition metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Documents" 
          value={totals.books} 
          icon={Book} 
          colorClass="bg-accent-blue/10 text-accent-blue"
        />
        <StatCard 
          title="Extracted Topics" 
          value={totals.topics} 
          icon={Layers} 
          colorClass="bg-indigo-500/10 text-indigo-600"
        />
        <StatCard 
          title="Total Flashcards" 
          value={totals.flashcards} 
          icon={Brain} 
          colorClass="bg-amber-500/10 text-amber-600"
        />
        <StatCard 
          title="Reviews Completed" 
          value={totals.total_reviews} 
          icon={CheckCircle2} 
          colorClass="bg-accent-blue/10 text-accent-blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] p-6 shadow-[var(--shadow-default)]">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-accent-blue" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-primary">7-Day Forecast</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast_7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#c6c6cd" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#76777d" 
                  tick={{fill: '#76777d', fontSize: 12}} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string | number) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                />
                <YAxis 
                  stroke="#76777d" 
                  tick={{fill: '#76777d', fontSize: 12}} 
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#E2E8F0', borderRadius: '6px' }}
                  itemStyle={{ color: '#2563EB' }}
                  labelStyle={{ color: '#45464d', marginBottom: '4px' }}
                  formatter={(value: any) => [value, 'Due Cards']}
                  labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                />
                <Bar 
                  dataKey="due_count" 
                  fill="#2563EB" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] p-6 shadow-[var(--shadow-default)] flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={20} className="text-indigo-600" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-primary">Current Queue</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-accent-blue"></div>
                <span className="text-on-surface font-medium">New Cards</span>
              </div>
              <span className="text-xl font-semibold text-primary">{queue.new}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-on-surface font-medium">Learning</span>
              </div>
              <span className="text-xl font-semibold text-primary">{queue.learning}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-accent-blue"></div>
                <span className="text-on-surface font-medium">To Review</span>
              </div>
              <span className="text-xl font-semibold text-primary">{queue.review}</span>
            </div>
            
            <div className="mt-4 pt-6 border-t border-outline-variant">
              <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-[var(--radius-large)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-accent-blue font-medium">
                  <Clock size={18} strokeWidth={1.5} /> Due Now
                </div>
                <span className="text-2xl font-bold text-accent-blue">{queue.due_now}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-surface-container-lowest border border-border-default rounded-[var(--radius-large)] p-6 shadow-[var(--shadow-default)]">
        <h3 className="text-lg font-semibold text-primary mb-6">Algorithm Health (FSRS)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-surface-container rounded-[var(--radius-standard)] border border-outline-variant">
            <div className="text-sm font-medium text-on-surface-variant mb-1">Average Memory Stability</div>
            <div className="text-2xl font-bold text-primary">{fsrs_metrics.average_stability_days} <span className="text-sm font-normal text-on-surface-variant">days</span></div>
            <p className="text-xs text-on-surface-variant mt-2">How long you will remember information before forgetting.</p>
          </div>
          <div className="p-4 bg-surface-container rounded-[var(--radius-standard)] border border-outline-variant">
            <div className="text-sm font-medium text-on-surface-variant mb-1">Average Card Difficulty</div>
            <div className="text-2xl font-bold text-primary">{fsrs_metrics.average_difficulty} <span className="text-sm font-normal text-on-surface-variant">/ 10</span></div>
            <p className="text-xs text-on-surface-variant mt-2">Inherent complexity of your flashcards.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
