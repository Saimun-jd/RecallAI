import { useEffect, useState } from 'react';
import { client } from '../api/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import { Book, Layers, Brain, CheckCircle2, Download, Share2, AlertCircle, TrendingUp } from 'lucide-react';
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
      <div className="flex items-center justify-center h-full bg-[#f0f0f0]">
        <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-black border-t-blue-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full bg-[#f0f0f0] text-black flex-col gap-4 font-bold">
        <AlertCircle size={48} strokeWidth={2.5} />
        <p className="text-xl">Could not load analytics data.</p>
      </div>
    );
  }

  const { totals, queue, fsrs_metrics, forecast_7d } = stats;

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className={clsx("border-2 border-on-surface rounded-xl shadow-[8px_8px_0px_0px_#191b23] p-5 relative overflow-hidden transition-all duration-200 hover:-translate-y-1 flex flex-col min-h-[120px] justify-between gap-4", colorClass)}>
      <div className="flex items-center gap-3">
        <div className="p-2 border-2 border-on-surface bg-surface-container-lowest rounded-md shrink-0 flex items-center justify-center">
          <Icon size={20} strokeWidth={2.5} className="text-on-surface" />
        </div>
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider break-words min-w-0 leading-tight">
          {title}
        </h3>
      </div>
      <div>
        <div className="text-3xl font-black text-on-surface">{value}</div>
        {subtitle && <p className="text-xs font-bold text-on-surface mt-1 opacity-80">{subtitle}</p>}
      </div>
    </div>
  );

  const colors = ['#3b82f6'];

  const QueueItem = ({ label, count, total, color }: any) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex justify-between font-bold mb-2">
          <span className="text-on-surface uppercase tracking-wide text-sm">{label}</span>
          <span className="text-on-surface">{count}</span>
        </div>
        <div className="h-3 border-2 border-on-surface bg-surface-container-lowest rounded-full overflow-hidden">
          <div 
            className="h-full border-r-2 border-on-surface last:border-r-0"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  };
  
  const totalQueue = (queue.new || 0) + (queue.learning || 0) + (queue.review || 0);

  return (
    <div className="flex-1 overflow-y-auto bg-surface font-sans selection:bg-primary selection:text-white">
      <div className="p-8 max-w-7xl mx-auto w-full pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight mb-2">Learning Analytics</h2>
          <p className="text-base font-bold text-on-surface-variant max-w-2xl border-l-2 border-on-surface pl-4 py-1">
            Visualizing your knowledge acquisition, retention rates, and study performance across all digital workspaces.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => console.log('Download Report')}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-lowest text-on-surface font-bold uppercase tracking-wide border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] hover:bg-yellow-400 transition-colors active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
          >
            <Download size={18} strokeWidth={2.5} /> Download Report
          </button>
          <button 
            onClick={() => console.log('Share Data')}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface text-on-surface font-bold uppercase tracking-wide border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] hover:bg-surface-container-highest transition-colors active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
          >
            <Share2 size={18} strokeWidth={2.5} /> Share Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="Documents" 
          value={totals.books} 
          icon={Book} 
          colorClass="bg-surface-container-lowest"
        />
        <StatCard 
          title="Topics" 
          value={totals.topics} 
          icon={Layers} 
          colorClass="bg-surface-container-lowest"
        />
        <StatCard 
          title="Flashcards" 
          value={totals.flashcards} 
          icon={Brain} 
          colorClass="bg-surface-container-lowest"
        />
        <StatCard 
          title="Reviews" 
          value={totals.total_reviews} 
          icon={CheckCircle2} 
          colorClass="bg-surface-container-lowest"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        {/* Chart Section */}
        <div className="xl:col-span-2 bg-surface-container-lowest border-2 border-on-surface rounded-2xl shadow-[8px_8px_0px_0px_#191b23] p-6 lg:p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-8 border-b-2 border-on-surface pb-4">
            <TrendingUp size={24} strokeWidth={2.5} className="text-on-surface" />
            <h3 className="text-xl font-black uppercase tracking-wide text-on-surface">7-Day Forecast</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast_7d} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#191b23" vertical={false} strokeWidth={2} opacity={0.2} />
                <XAxis 
                  dataKey="date" 
                  stroke="#191b23" 
                  tick={{fill: '#191b23', fontSize: 12, fontWeight: 'bold'}} 
                  tickLine={{stroke: '#191b23', strokeWidth: 2}}
                  axisLine={{stroke: '#191b23', strokeWidth: 2}}
                  tickFormatter={(val: string) => {
                    const [, m, d] = val.split('-');
                    return `${parseInt(m)}/${parseInt(d)}`;
                  }}
                  dy={10}
                />
                <YAxis 
                  stroke="#191b23" 
                  tick={{fill: '#191b23', fontSize: 12, fontWeight: 'bold'}} 
                  tickLine={{stroke: '#191b23', strokeWidth: 2}}
                  axisLine={{stroke: '#191b23', strokeWidth: 2}}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(25,27,35,0.05)'}}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '2px solid #191b23', 
                    boxShadow: '4px 4px 0px 0px #191b23',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#191b23', fontWeight: '900', fontSize: '16px' }}
                  labelStyle={{ color: '#191b23', marginBottom: '8px', textTransform: 'uppercase', fontSize: '12px' }}
                  formatter={(value: any) => [value, 'Due Cards']}
                  labelFormatter={(label: any) => {
                     return new Date(label + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                  }}
                />
                <Bar 
                  dataKey="due_count" 
                  radius={[4, 4, 0, 0]} 
                  barSize={40}
                  animationDuration={1000}
                >
                  {
                    forecast_7d.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="#191b23" strokeWidth={2} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Queue / Subject Breakdown Section */}
        <div className="bg-surface-container-lowest border-2 border-on-surface rounded-2xl shadow-[8px_8px_0px_0px_#191b23] p-6 lg:p-8 flex flex-col">
          <div className="mb-8 border-b-2 border-on-surface pb-4">
            <h3 className="text-xl font-black uppercase tracking-wide text-on-surface">Current Queue</h3>
          </div>
          
          <div className="flex-1 flex flex-col justify-center mb-8">
            <QueueItem label="New Cards" count={queue.new} total={totalQueue} color="#3b82f6" />
            <QueueItem label="Learning" count={queue.learning} total={totalQueue} color="#8b5cf6" />
            <QueueItem label="To Review" count={queue.review} total={totalQueue} color="#10b981" />
          </div>
          
          <div className="mt-auto">
            <div className="bg-surface border-2 border-on-surface rounded-xl shadow-[4px_4px_0px_0px_#191b23] p-4 flex items-center justify-between transition-transform hover:-translate-y-1">
              <div className="text-on-surface font-black uppercase tracking-wide">
                Due Now
              </div>
              <span className="text-2xl font-black text-on-background px-3 py-1 bg-[#FFF44F] border-2 border-on-surface rounded-lg shadow-[2px_2px_0px_0px_#191b23]">
                {queue.due_now}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Algorithm Health / Table replacement */}
      <div className="bg-surface-container-lowest border-2 border-on-surface rounded-2xl shadow-[8px_8px_0px_0px_#191b23] p-6 lg:p-8">
        <h3 className="text-xl font-black uppercase tracking-wide text-on-surface mb-6 border-b-2 border-on-surface pb-4">
          Algorithm Health (FSRS)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col md:flex-row gap-6 items-center p-6 bg-surface border-2 border-on-surface rounded-xl hover:bg-surface-container-high transition-colors">
            <div className="w-16 h-16 bg-[#3b82f6] text-white border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] flex items-center justify-center shrink-0 rounded-full">
              <span className="text-xl font-black">{fsrs_metrics.average_stability_days}d</span>
            </div>
            <div>
              <div className="text-base font-black uppercase tracking-wide mb-1 text-on-surface">Memory Stability</div>
              <p className="text-xs font-bold text-on-surface-variant">Average time before you forget information.</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-center p-6 bg-surface border-2 border-on-surface rounded-xl hover:bg-surface-container-high transition-colors">
            <div className="w-16 h-16 bg-[#8b5cf6] text-white border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] flex items-center justify-center shrink-0 rounded-full">
              <span className="text-xl font-black">{fsrs_metrics.average_difficulty}<span className="text-sm">/10</span></span>
            </div>
            <div>
              <div className="text-base font-black uppercase tracking-wide mb-1 text-on-surface">Card Difficulty</div>
              <p className="text-xs font-bold text-on-surface-variant">Inherent complexity of your current flashcards.</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
