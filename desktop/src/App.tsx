import { useEffect, useState } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { type RootState } from './store';
import { client } from './api/client';
import { DashboardView } from './views/DashboardView';
import { DocumentsView } from './views/DocumentsView';
import { DocumentDetailView } from './views/DocumentDetailView';
import { KnowledgeHubView } from './views/KnowledgeHubView';
import { LibraryView } from './views/LibraryView';
import { NotesView } from './views/NotesView';
import { ReviewView } from './views/ReviewView';
import { SettingsView } from './views/SettingsView';
import { BookDetailView } from './views/BookDetailView';
import { AnalyticsView } from './views/AnalyticsView';
import { LLMInspectionView } from './views/LLMInspectionView';
import { loadSettings } from './api/settingsStore';
import { getApiKey } from './api/keychain';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getActiveKeychainSave, isTauriEnvironment } from './api/keychain';
import { getActiveSettingsSave } from './api/settingsStore';
import { getActiveSaveOperation } from './api/saveCoordinator';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useAutoSync } from './hooks/useAutoSync';
import { AppShell } from './components/layout';
import { setSidecarStatus } from './store';
import { 
  LandingView, 
  PricingView, 
  HowItWorksView, 
  SecurityView, 
  PrivacyView, 
  TermsView 
} from './views/public';
import {
  LoginView,
  RegisterView,
  ForgotPasswordView,
  OnboardingView
} from './views/auth';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth';
import { useAuth } from './contexts/AuthContext';

function WorkspaceLayout({ bootTime, sidecarStatus }: { bootTime: number; sidecarStatus: any }) {
  const { user } = useAuth();
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => {
    return localStorage.getItem('has-seen-welcome') === 'true';
  });

  const handleWelcomeComplete = () => {
    localStorage.setItem('has-seen-welcome', 'true');
    setHasSeenWelcome(true);
  };

  return (
    <>
      {!hasSeenWelcome && <WelcomeScreen onComplete={handleWelcomeComplete} />}
      <AppShell
        user={user}
        bootTime={bootTime}
        sidecarStatus={sidecarStatus}
      >
        <Outlet />
      </AppShell>
    </>
  );
}

export default function App() {
  const [bootTime] = useState(Date.now());
  const { token } = useAuth();
  const sidecarStatus = useSelector((state: RootState) => state.system.sidecarStatus);
  const cloudUploadState = useSelector((state: RootState) => state.system.cloudUploadState);
  const [contrastLevel, setContrastLevel] = useState(() => {
    return parseInt(localStorage.getItem('app-contrast-level') || '0', 10);
  });

  useEffect(() => {
    const root = document.documentElement;
    if (contrastLevel === 0 || root.classList.contains('dark') || root.getAttribute('data-theme') === 'dark') {
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
  
  // Auto sync hook
  useAutoSync(token);

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

        const backendKeys: Record<string, string> = {};
        for (const provider of ['openai', 'gemini', 'groq']) {
          const key = await getApiKey(provider);
          if (key) {
            dispatch({ type: 'providers/setConfiguredProvider', payload: { provider, isConfigured: true } });
            backendKeys[`${provider}_api_key`] = key;
          }
        }
        for (const extraKey of ['datalab_api_key', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host', 'ollama_host']) {
          const key = await getApiKey(extraKey);
          if (key) {
            backendKeys[extraKey] = key;
          }
        }
        
        // Sync loaded keys to Python sidecar immediately on boot
        if (Object.keys(backendKeys).length > 0) {
          client.saveApiKeys(backendKeys).catch((err) => {
            console.warn('[App] Non-critical boot key sync error:', err);
          });
        }

        // Sync active provider and extractor to Python sidecar
        if (settings.activeProvider) {
          client.updateSetting('llm_provider', JSON.stringify({ type: settings.activeProvider })).catch((err) =>
            console.warn('[App] Non-critical boot provider sync error:', err)
          );
        }
        if (settings.pdfExtractor) {
          client.updateSetting('pdf_extractor', settings.pdfExtractor).catch((err) =>
            console.warn('[App] Non-critical boot extractor sync error:', err)
          );
        }
        console.log('[Keychain] Hydration complete.');
      } catch (e) {
        console.error("Failed to load settings on boot", e);
      }
    };

    checkHealth();
    loadGlobalSettings();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        checkHealth();
      }
    }, 10000);
    return () => {
      clearInterval(interval);
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
    <>
      <Routes>
        {/* Public marketing pages */}
        <Route path="/" element={<LandingView />} />
        <Route path="/pricing" element={<PricingView />} />
        <Route path="/how-it-works" element={<HowItWorksView />} />
        <Route path="/security" element={<SecurityView />} />
        <Route path="/privacy" element={<PrivacyView />} />
        <Route path="/terms" element={<TermsView />} />

        {/* Public-only auth pages */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginView />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterView />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordView />
            </PublicOnlyRoute>
          }
        />

        {/* Guided Onboarding route */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute requireOnboarding={false}>
              <OnboardingView />
            </ProtectedRoute>
          }
        />

        {/* Protected workspace routes inside AppShell */}
        <Route
          element={
            <ProtectedRoute>
              <WorkspaceLayout bootTime={bootTime} sidecarStatus={sidecarStatus} />
            </ProtectedRoute>
          }
        >
          <Route path="/app" element={<DashboardView />} />
          <Route path="/documents" element={<DocumentsView />} />
          <Route path="/app/documents" element={<DocumentsView />} />
          <Route path="/chat" element={<KnowledgeHubView />} />
          <Route path="/app/chat" element={<KnowledgeHubView />} />
          <Route path="/notes" element={<NotesView />} />
          <Route path="/review" element={<ReviewView />} />
          <Route path="/app/review" element={<ReviewView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/app/analytics" element={<AnalyticsView />} />
          <Route path="/llm-inspection" element={<LLMInspectionView />} />
          <Route path="/app/llm-inspection" element={<LLMInspectionView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/app/settings" element={<SettingsView />} />
          <Route path="/books/:id" element={<BookDetailView />} />
          <Route path="/documents/:id" element={<DocumentDetailView />} />
          <Route path="/app/documents/:id" element={<DocumentDetailView />} />
          <Route path="*" element={<DocumentsView />} />
        </Route>
      </Routes>

      {/* Cloud Upload Progress Indicator */}
      {cloudUploadState?.isUploading && (
        <div className="fixed bottom-6 right-6 z-[100] w-80 bg-surface border-2 border-border-default shadow-neo rounded-xl p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sm text-on-surface truncate pr-2">Uploading {cloudUploadState.fileName}...</span>
            <span className="text-xs font-bold text-on-surface bg-surface-container border border-border-default px-2 py-0.5 rounded-full">{cloudUploadState.progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${cloudUploadState.progress}%` }}
            />
          </div>
          <span className="text-[11px] text-on-surface-variant text-center uppercase tracking-wider font-bold">Do not close app</span>
        </div>
      )}
    </>
  );
}
