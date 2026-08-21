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
    <div className={clsx("border-[3px] border-black neo-shadow p-5 relative overflow-hidden transition-all duration-200 hover:-translate-y-1 flex flex-col min-h-[140px] justify-between gap-4", colorClass)}>
      <div className="flex items-center gap-3">
        <div className="p-2 border-2 border-black bg-white rounded-md shrink-0 flex items-center justify-center">
          <Icon size={22} strokeWidth={2.5} className="text-black" />
        </div>
        <h3 className="text-sm lg:text-base font-black text-black uppercase tracking-wider break-words min-w-0 leading-tight">
          {title}
        </h3>
      </div>
      <div>
        <div className="text-4xl font-black text-black">{value}</div>
        {subtitle && <p className="text-xs font-bold text-black mt-1 opacity-80">{subtitle}</p>}
      </div>
    </div>
  );

  const colors = ['#3b82f6', '#eab308', '#22c55e', '#ef4444', '#a855f7', '#f97316', '#ec4899'];

  const QueueItem = ({ label, count, total, color }: any) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex justify-between font-bold mb-2">
          <span className="text-black uppercase tracking-wide text-sm">{label}</span>
          <span className="text-black">{count}</span>
        </div>
        <div className="h-4 border-[3px] border-black bg-white rounded-full overflow-hidden">
          <div 
            className="h-full border-r-[3px] border-black last:border-r-0"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
      </div>
    );
  };
  
  const totalQueue = (queue.new || 0) + (queue.learning || 0) + (queue.review || 0);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full flex-1 overflow-y-auto bg-[#f4f4f0] font-sans selection:bg-black selection:text-white pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-black text-black tracking-tight mb-2">Learning Analytics</h2>
          <p className="text-lg font-bold text-black/70 max-w-2xl border-l-[4px] border-black pl-4 py-1">
            Visualizing your knowledge acquisition, retention rates, and study performance across all digital workspaces.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => console.log('Download Report')}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold uppercase tracking-wide border-[3px] border-black neo-shadow hover:bg-yellow-400 transition-colors active:translate-y-1 active:translate-x-1 active:shadow-none"
          >
            <Download size={20} strokeWidth={2.5} /> Download Report
          </button>
          <button 
            onClick={() => console.log('Share Data')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-bold uppercase tracking-wide border-[3px] border-black neo-shadow hover:bg-blue-600 transition-colors active:translate-y-1 active:translate-x-1 active:shadow-none"
          >
            <Share2 size={20} strokeWidth={2.5} /> Share Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="Documents" 
          value={totals.books} 
          icon={Book} 
          colorClass="bg-blue-400"
        />
        <StatCard 
          title="Topics" 
          value={totals.topics} 
          icon={Layers} 
          colorClass="bg-purple-400"
        />
        <StatCard 
          title="Flashcards" 
          value={totals.flashcards} 
          icon={Brain} 
          colorClass="bg-yellow-400"
        />
        <StatCard 
          title="Reviews" 
          value={totals.total_reviews} 
          icon={CheckCircle2} 
          colorClass="bg-green-400"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        {/* Chart Section */}
        <div className="xl:col-span-2 bg-white border-[3px] border-black neo-shadow p-6 lg:p-8 flex flex-col">
          <div className="flex items-center gap-3 mb-8 border-b-[3px] border-black pb-4">
            <TrendingUp size={28} strokeWidth={2.5} className="text-black" />
            <h3 className="text-2xl font-black uppercase tracking-wide text-black">7-Day Forecast</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast_7d} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#000" vertical={false} strokeWidth={2} />
                <XAxis 
                  dataKey="date" 
                  stroke="#000" 
                  tick={{fill: '#000', fontSize: 14, fontWeight: 'bold'}} 
                  tickLine={{stroke: '#000', strokeWidth: 2}}
                  axisLine={{stroke: '#000', strokeWidth: 3}}
                  tickFormatter={(val: string) => {
                    const [, m, d] = val.split('-');
                    return `${parseInt(m)}/${parseInt(d)}`;
                  }}
                  dy={10}
                />
                <YAxis 
                  stroke="#000" 
                  tick={{fill: '#000', fontSize: 14, fontWeight: 'bold'}} 
                  tickLine={{stroke: '#000', strokeWidth: 2}}
                  axisLine={{stroke: '#000', strokeWidth: 3}}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.05)'}}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '3px solid #000', 
                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                    borderRadius: '0',
                    fontWeight: 'bold',
                    padding: '12px'
                  }}
                  itemStyle={{ color: '#000', fontWeight: '900', fontSize: '18px' }}
                  labelStyle={{ color: '#000', marginBottom: '8px', textTransform: 'uppercase', fontSize: '12px' }}
                  formatter={(value: any) => [value, 'Due Cards']}
                  labelFormatter={(label: any) => {
                     return new Date(label + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                  }}
                />
                <Bar 
                  dataKey="due_count" 
                  radius={[0, 0, 0, 0]} 
                  barSize={50}
                  animationDuration={1000}
                >
                  {
                    forecast_7d.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="#000" strokeWidth={3} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Queue / Subject Breakdown Section */}
        <div className="bg-white border-[3px] border-black neo-shadow p-6 lg:p-8 flex flex-col">
          <div className="mb-8 border-b-[3px] border-black pb-4">
            <h3 className="text-2xl font-black uppercase tracking-wide text-black">Current Queue</h3>
          </div>
          
          <div className="flex-1 flex flex-col justify-center mb-8">
            <QueueItem label="New Cards" count={queue.new} total={totalQueue} color="#3b82f6" />
            <QueueItem label="Learning" count={queue.learning} total={totalQueue} color="#eab308" />
            <QueueItem label="To Review" count={queue.review} total={totalQueue} color="#a855f7" />
          </div>
          
          <div className="mt-auto">
            <div className="bg-red-400 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 flex items-center justify-between transition-transform hover:-translate-y-1">
              <div className="text-black font-black uppercase tracking-wide">
                Due Now
              </div>
              <span className="text-3xl font-black text-white px-3 bg-black border-2 border-black rounded-sm shadow-[2px_2px_0px_0px_rgba(255,255,255,0.5)]">
                {queue.due_now}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Algorithm Health / Table replacement */}
      <div className="bg-white border-[3px] border-black neo-shadow p-6 lg:p-8">
        <h3 className="text-2xl font-black uppercase tracking-wide text-black mb-6 border-b-[3px] border-black pb-4">
          Algorithm Health (FSRS)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col md:flex-row gap-6 items-center p-6 bg-[#f4f4f0] border-[3px] border-black hover:bg-green-100 transition-colors">
            <div className="w-24 h-24 bg-green-400 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center shrink-0 rounded-full">
              <span className="text-2xl font-black">{fsrs_metrics.average_stability_days}d</span>
            </div>
            <div>
              <div className="text-lg font-black uppercase tracking-wide mb-1 text-black">Memory Stability</div>
              <p className="text-sm font-bold text-black/70">Average time before you forget information.</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-center p-6 bg-[#f4f4f0] border-[3px] border-black hover:bg-orange-100 transition-colors">
            <div className="w-24 h-24 bg-orange-400 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center shrink-0 rounded-full">
              <span className="text-2xl font-black">{fsrs_metrics.average_difficulty}<span className="text-sm">/10</span></span>
            </div>
            <div>
              <div className="text-lg font-black uppercase tracking-wide mb-1 text-black">Card Difficulty</div>
              <p className="text-sm font-bold text-black/70">Inherent complexity of your current flashcards.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
