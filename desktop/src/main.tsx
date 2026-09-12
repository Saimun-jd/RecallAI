import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { store } from './store'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './hooks/useToast'
import App from './App.tsx'
import './index.css'
import 'katex/dist/katex.min.css'
import { getCurrent } from '@tauri-apps/plugin-deep-link'
import { listen } from '@tauri-apps/api/event'
import { supabase } from './lib/supabase'
import { isTauriEnvironment } from './api/keychain'

;(window as any).supabase = supabase;

const handleAuthUrl = async (url: string) => {
  console.log('[DeepLink] Received URL:', url);
  if (url.includes('recallai://')) {
    const hash = url.split('#')[1];
    if (hash) {
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      console.log('[DeepLink] Extracted tokens:', { hasAccessToken: !!access_token, hasRefreshToken: !!refresh_token });
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        console.log('[DeepLink] setSession result:', error ? error.message : 'Success');
        // Force a UI update just in case onAuthStateChange is flaky
        window.dispatchEvent(new Event('auth-session-updated'));
      }
    }
  }
};

if (isTauriEnvironment()) {
  // Cold start: app was just launched by the deep link
  getCurrent().then(urls => {
    if (urls && Array.isArray(urls)) {
      for (const url of urls) {
        if (url.includes('recallai://')) {
          handleAuthUrl(url);
        }
      }
    }
  }).catch(console.error);

  // Already running: your Rust side forwards it as "deep-link-urls"
  listen<string[]>('deep-link-urls', (event) => {
    console.log('[DeepLink] Received deep-link-urls event with payload:', event.payload);
    if (event.payload && Array.isArray(event.payload)) {
      for (const arg of event.payload) {
        if (arg.includes('recallai://')) {
          handleAuthUrl(arg);
        }
      }
    }
  });
}
createRoot(document.getElementById('root')!).render(
    <Provider store={store}>
      <HashRouter>
        <ErrorBoundary>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ErrorBoundary>
      </HashRouter>
    </Provider>,
)
