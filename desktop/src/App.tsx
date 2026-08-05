import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from './store';
import { client } from './api/client';
import { Book, BrainCircuit, Settings, Zap, Loader2, Search } from 'lucide-react';
import clsx from 'clsx';
import { LibraryView } from './views/LibraryView';
import { ReviewView } from './views/ReviewView';
import { SettingsView } from './views/SettingsView';
import { BookDetailView } from './views/BookDetailView';
import { AnalyticsView } from './views/AnalyticsView';
import { CommandPalette } from './components/CommandPalette';
import { loadSettings } from './api/settingsStore';
import { getApiKey } from './api/keychain';
import { BarChart3 } from 'lucide-react';
// Temporarily using app slice sidecar status since I didn't delete it
// I need to add sidecarStatus to appSlice or create appSlice again?
// Wait, I replaced index.ts to remove appSlice! 
// Let's create an appSlice or just fetch sidecar state locally for StatusBar.
// Actually, I'll just manage sidecar state locally in App.tsx for now or I'll re-add it to the store.
// Let's just manage it in a local state in App.tsx for simplicity, since only StatusBar uses it.

function Sidebar() {
  const location = useLocation();
  
  const linkClass = (path: string) => clsx(
    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
    location.pathname === path 
      ? "bg-zinc-800 text-emerald-400 shadow-sm" 
      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
  );

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-zinc-800/50">
        <h1 className="text-xl font-semibold flex items-center gap-2 tracking-tight text-zinc-100">
          <BrainCircuit className="text-emerald-500 w-6 h-6" />
          Recall
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-1.5">
        <Link to="/" className={linkClass("/")}>
          <Book size={18} />
          Library
        </Link>
        <Link to="/review" className={linkClass("/review")}>
          <Zap size={18} />
          Review
        </Link>
        <Link to="/analytics" className={linkClass("/analytics")}>
          <BarChart3 size={18} />
          Analytics
        </Link>
        <Link to="/settings" className={linkClass("/settings")}>
          <Settings size={18} />
          Settings
        </Link>
      </nav>
      
      {/* Keyboard Shortcut Hint */}
      <div className="p-4 mt-auto">
        <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-500 bg-zinc-950 rounded-md border border-zinc-800/50">
          <span className="flex items-center gap-1.5"><Search size={14} /> Search</span>
          <div className="flex items-center gap-1">
            <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">Ctrl</kbd>
            <span>+</span>
            <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">K</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ bootTime, sidecarStatus }: { bootTime: number, sidecarStatus: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (sidecarStatus === 'connected') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - bootTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sidecarStatus, bootTime]);

  const isBooting = elapsed < 30 && sidecarStatus !== 'connected';

  return (
    <div className="h-9 bg-zinc-900 text-zinc-400 text-xs flex items-center px-6 border-t border-zinc-800 justify-between shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span>Recall v0.2.0</span>
      </div>
      <div className="flex items-center gap-2 font-medium">
        <span>Engine:</span>
        {sidecarStatus === 'connected' ? (
          <span className="text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> 
            Online
          </span>
        ) : isBooting ? (
          <span className="text-amber-400 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> 
            Waking up ({elapsed}s)
          </span>
        ) : (
          <span className="text-red-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> 
            Disconnected
          </span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [bootTime] = useState(Date.now());
  const [sidecarStatus, setSidecarStatus] = useState<'connected' | 'error' | 'booting'>('booting');

  const dispatch = useDispatch();

  useEffect(() => {
    // Health check polling
    const checkHealth = async () => {
      try {
        await client.checkHealth();
        setSidecarStatus('connected');
      } catch (err) {
        setSidecarStatus('error');
      }
    };

    // Load global settings and hydrate keychain on boot
    const loadGlobalSettings = async () => {
      try {
        const settings = await loadSettings();
        if (settings.activeProvider) {
          dispatch({ type: 'providers/setActiveProvider', payload: settings.activeProvider });
        }
        
        // Hydrate API keys
        console.log('[Keychain] Hydrating keys on startup...');
        for (const provider of ['openai', 'gemini', 'groq']) {
          const key = await getApiKey(provider);
          if (key) {
            dispatch({ type: 'providers/setConfiguredProvider', payload: { provider, isConfigured: true } });
          }
        }
        console.log('[Keychain] Hydration complete.');
      } catch (e) {
        console.error("Failed to load settings on boot", e);
      }
    };

    checkHealth();
    loadGlobalSettings();
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <CommandPalette />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        {/* Main Viewport */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-zinc-950">
          <Routes>
            <Route path="/" element={<LibraryView />} />
            <Route path="/review" element={<ReviewView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/books/:id" element={<BookDetailView />} />
            <Route path="*" element={<LibraryView />} />
          </Routes>
        </main>
      </div>
      
      <StatusBar bootTime={bootTime} sidecarStatus={sidecarStatus} />
    </div>
  );
}
