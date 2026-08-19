import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from './store';
import { client } from './api/client';
import { LibraryView } from './views/LibraryView';
import { ReviewView } from './views/ReviewView';
import { SettingsView } from './views/SettingsView';
import { BookDetailView } from './views/BookDetailView';
import { AnalyticsView } from './views/AnalyticsView';
import { CommandPalette } from './components/CommandPalette';
import { loadSettings } from './api/settingsStore';
import { getApiKey } from './api/keychain';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';

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
        if (settings.pdfTheme) {
          dispatch({ type: 'reader/setPdfTheme', payload: settings.pdfTheme });
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
    <div className="flex flex-col h-screen bg-surface text-on-surface overflow-hidden font-sans antialiased">
      <CommandPalette />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        {/* Main Viewport - Academic Precision: Clean background hierarchy */}
        <main className="flex-1 overflow-y-auto relative flex flex-col bg-surface">
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
