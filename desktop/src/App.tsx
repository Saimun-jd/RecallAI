import { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from './store';
import { client } from './api/client';
import { LibraryView } from './views/LibraryView';
import { NotesView } from './views/NotesView';
import { ReviewView } from './views/ReviewView';
import { SettingsView } from './views/SettingsView';
import { BookDetailView } from './views/BookDetailView';
import { AnalyticsView } from './views/AnalyticsView';
import { CommandPalette } from './components/CommandPalette';
import { loadSettings } from './api/settingsStore';
import { getApiKey } from './api/keychain';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getActiveKeychainSave, isTauriEnvironment } from './api/keychain';
import { getActiveSettingsSave } from './api/settingsStore';
import { getActiveSaveOperation } from './api/saveCoordinator';
import { WelcomeScreen } from './components/WelcomeScreen';
import { supabase } from './lib/supabase';
import { useAutoSync } from './hooks/useAutoSync';

import { setSidecarStatus } from './store';

export default function App() {
  const [bootTime] = useState(Date.now());
  const [user, setUser] = useState<any>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [isSwitchingDb, setIsSwitchingDb] = useState(true);
  const sidecarStatus = useSelector((state: RootState) => state.system.sidecarStatus);
  const cloudUploadState = useSelector((state: RootState) => state.system.cloudUploadState);
  const [contrastLevel, setContrastLevel] = useState(() => {
    return parseInt(localStorage.getItem('app-contrast-level') || '0', 10);
  });
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => {
    return localStorage.getItem('has-seen-welcome') === 'true';
  });

  const handleWelcomeComplete = () => {
    localStorage.setItem('has-seen-welcome', 'true');
    setHasSeenWelcome(true);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (contrastLevel === 0) {
      root.style.removeProperty('--color-background');
      root.style.removeProperty('--color-surface');
      root.style.removeProperty('--color-surface-container-lowest');
      root.style.removeProperty('--color-surface-container-low');
      root.style.removeProperty('--color-surface-container');
      root.style.removeProperty('--color-surface-container-high');
      root.style.removeProperty('--color-surface-container-highest');
      root.style.removeProperty('--color-on-background');
      root.style.removeProperty('--color-on-surface');
      root.style.removeProperty('--color-on-surface-variant');
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-outline');
      root.style.removeProperty('--color-outline-variant');
      localStorage.setItem('app-contrast-level', '0');
      return;
    }
    
    const lerpColor = (hex: string, targetHex: string, ratio: number) => {
      const parse = (c: string) => {
        if (c.startsWith('#')) c = c.slice(1);
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        return [
          parseInt(c.slice(0, 2), 16),
          parseInt(c.slice(2, 4), 16),
          parseInt(c.slice(4, 6), 16)
        ];
      };
      
      const [r1, g1, b1] = parse(hex);
      const [r2, g2, b2] = parse(targetHex);
      
      const clamp = (val: number) => Math.min(255, Math.max(0, val));
      const r = clamp(Math.round(r1 + (r2 - r1) * ratio));
      const g = clamp(Math.round(g1 + (g2 - g1) * ratio));
      const b = clamp(Math.round(b1 + (b2 - b1) * ratio));
      
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };

    const ratio = contrastLevel / 100;
    
    const bgColors = {
      '--color-background': '#faf8ff',
      '--color-surface': '#F8F7F4',
      '--color-surface-container-lowest': '#F8F7F4',
      '--color-surface-container-low': '#F2F0EA',
      '--color-surface-container': '#EDEBE3',
      '--color-surface-container-high': '#E5E2D8',
      '--color-surface-container-highest': '#e2e2ec',
    };
    
    const textColors = {
      '--color-on-background': '#191b23',
      '--color-on-surface': '#191b23',
      '--color-on-surface-variant': '#434654',
      '--color-primary': '#003594',
      '--color-outline': '#737685',
      '--color-outline-variant': '#c3c6d6',
    };

    Object.entries(bgColors).forEach(([key, baseHex]) => {
      root.style.setProperty(key, lerpColor(baseHex, '#ffffff', ratio));
    });

    Object.entries(textColors).forEach(([key, baseHex]) => {
      root.style.setProperty(key, lerpColor(baseHex, '#000000', ratio));
    });
    
    localStorage.setItem('app-contrast-level', contrastLevel.toString());
  }, [contrastLevel]);

  const dispatch = useDispatch();
  
  // We need the token for auto-sync, so let's extract it from the session state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  
  // Import the auto sync hook
  const { triggerSync } = useAutoSync(sessionToken);

  useEffect(() => {
    // Health check polling
    const checkHealth = async () => {
      try {
        await client.checkHealth();
        dispatch(setSidecarStatus('connected'));
      } catch (err) {
        dispatch(setSidecarStatus('error'));
      }
    };

    // Helper to switch backend DB
    const updateBackendUser = async (sessionUser: any, sessionToken: string | null = null) => {
      setIsSwitchingDb(true);
      try {
        await fetch('http://localhost:8000/api/set-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            user_id: sessionUser?.id || null,
            token: sessionToken || null
          })
        });
      } catch (e) {
        console.error("Failed to set backend user", e);
      } finally {
        setUser(sessionUser || null);
        setActiveUserId(sessionUser?.id || 'default');
        setSessionToken(sessionToken);
        setIsSwitchingDb(false);
      }
    };

    // Load user session
    const refreshSession = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        updateBackendUser(session?.user, session?.access_token);
      });
    };

    refreshSession();
    window.addEventListener('auth-session-updated', refreshSession);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateBackendUser(session?.user, session?.access_token);
    });

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
        console.log('[Keychain] Migrating and hydrating keys on startup...');
        
        try {
          const { migrateLegacyKeys } = await import('./api/legacy-keyring-migration');
          await migrateLegacyKeys();
        } catch (err) {
          console.error("Migration check failed", err);
        }

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
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
      window.removeEventListener('auth-session-updated', refreshSession);
    };
  }, [dispatch]);

  // F11 Fullscreen toggle
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        try {
          const appWindow = getCurrentWindow();
          const isFullscreen = await appWindow.isFullscreen();
          if (isFullscreen) {
            await appWindow.setFullscreen(false);
            await appWindow.setDecorations(true);
          } else {
            await appWindow.setDecorations(false);
            await appWindow.setFullscreen(true);
          }
        } catch (err) {
          console.error("Failed to toggle fullscreen", err);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Window close handler to prevent data loss during saves
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    
    let unlisten: (() => void) | undefined;
    
    const setupCloseHandler = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          const saveOp = getActiveSaveOperation();
          const keychainSave = getActiveKeychainSave();
          const settingsSave = getActiveSettingsSave();
          
          if (saveOp || keychainSave || settingsSave) {
            event.preventDefault(); // Stop immediate close
            
            try {
              await Promise.all([
                saveOp || Promise.resolve(),
                keychainSave || Promise.resolve(),
                settingsSave || Promise.resolve()
              ]);
              // Saves succeeded, now actually close
              await appWindow.close();
            } catch (err) {
              const confirmClose = window.confirm("Save failed — close anyway?");
              if (confirmClose) {
                await appWindow.close();
              }
            }
          }
        });
      } catch (err) {
        console.error("Failed to setup close handler:", err);
      }
    };
    
    setupCloseHandler();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-on-surface font-sans antialiased overflow-hidden">
      <CommandPalette />
      {!hasSeenWelcome && <WelcomeScreen onComplete={handleWelcomeComplete} />}
      
      {/* Global Header */}
      <header className="fixed top-0 inset-x-0 z-50 bg-surface-container-low border-b-2 border-on-surface pt-[env(safe-area-inset-top,0px)]">
        <div className="h-16 px-5 flex items-center justify-between">
          <StatusBar bootTime={bootTime} sidecarStatus={sidecarStatus} />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border-2 border-on-surface rounded-lg px-3 py-1.5 bg-surface shadow-[2px_2px_0px_0px_#191b23]">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contrast</span>
              <input 
                type="range" 
                min="-100" 
                max="100" 
                value={contrastLevel}
                onChange={(e) => setContrastLevel(parseInt(e.target.value, 10))}
                className="w-20 lg:w-24 accent-on-surface cursor-pointer"
              />
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg border-2 border-on-surface active:translate-y-0.5 transition-transform hover:bg-surface-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-on-surface bg-primary flex items-center justify-center overflow-hidden shrink-0">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} referrerPolicy="no-referrer" alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex relative w-full pt-16 flex-row flex-1 h-full overflow-hidden">
        <Sidebar />
        
        {/* Main Viewport */}
        <main className="flex-1 flex flex-col bg-background relative min-w-0 overflow-y-auto">
          {isSwitchingDb ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-on-surface border-t-transparent rounded-full animate-spin"></div>
              <span className="text-on-surface-variant font-medium text-sm">Syncing local database...</span>
            </div>
          ) : (
            <Routes key={activeUserId || 'default'}>
              <Route path="/" element={<LibraryView />} />
              <Route path="/notes" element={<NotesView />} />
              <Route path="/review" element={<ReviewView />} />
              <Route path="/analytics" element={<AnalyticsView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="/books/:id" element={<BookDetailView />} />
              <Route path="*" element={<LibraryView />} />
            </Routes>
          )}
        </main>
      </div>
      
      {/* Cloud Upload Progress Indicator */}
      {cloudUploadState?.isUploading && (
        <div className="fixed bottom-6 right-6 z-[100] w-80 bg-surface border-2 border-on-surface shadow-[4px_4px_0px_0px_#191b23] rounded-lg p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sm text-on-surface truncate pr-2">Uploading {cloudUploadState.fileName}...</span>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{cloudUploadState.progress}%</span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${cloudUploadState.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-on-surface-variant text-center uppercase tracking-wider">Do not close app</span>
        </div>
      )}

    </div>
  );
}
