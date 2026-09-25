import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { store } from './store'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './hooks/useToast'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './contexts/AuthProvider'
import App from './App.tsx'
import './index.css'
import 'katex/dist/katex.min.css'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { listen } from '@tauri-apps/api/event'
import { supabase } from './lib/supabase'
import { isTauriEnvironment } from './api/keychain'

export const handleAuthUrl = async (urlStr: string) => {
  console.log('[DeepLink] Received URL:', urlStr);
  if (!urlStr || !urlStr.includes('recallai://')) return;

  try {
    let code: string | null = null;
    let access_token: string | null = null;
    let refresh_token: string | null = null;

    // 1. Check query parameters (?code=... or ?access_token=...)
    if (urlStr.includes('?')) {
      const queryString = urlStr.split('?')[1].split('#')[0];
      const params = new URLSearchParams(queryString);
      code = params.get('code');
      access_token = params.get('access_token');
      refresh_token = params.get('refresh_token');
    }

    // 2. Check hash parameters (#access_token=... or #code=...)
    if (urlStr.includes('#')) {
      const hashString = urlStr.split('#')[1];
      const params = new URLSearchParams(hashString);
      if (!code) code = params.get('code');
      if (!access_token) access_token = params.get('access_token');
      if (!refresh_token) refresh_token = params.get('refresh_token');
    }

    console.log('[DeepLink] Extracted auth payload:', {
      hasCode: Boolean(code),
      hasAccessToken: Boolean(access_token),
      hasRefreshToken: Boolean(refresh_token),
    });

    if (code) {
      console.log('[DeepLink] Exchanging PKCE code for Supabase session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[DeepLink] exchangeCodeForSession failed:', error.message);
      } else {
        console.log('[DeepLink] Successfully authenticated user via code exchange:', data.session?.user?.email);
        window.dispatchEvent(new Event('auth-session-updated'));
      }
    } else if (access_token && refresh_token) {
      console.log('[DeepLink] Setting session from direct tokens...');
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        console.error('[DeepLink] setSession failed:', error.message);
      } else {
        console.log('[DeepLink] Session set successfully:', data.session?.user?.email);
        window.dispatchEvent(new Event('auth-session-updated'));
      }
    }
  } catch (err) {
    console.error('[DeepLink] Error handling auth URL:', err);
  }
};

if (isTauriEnvironment()) {
  // Cold start: app was just launched by the deep link
  getCurrent().then(urls => {
    if (urls && Array.isArray(urls)) {
      for (const url of urls) {
        if (typeof url === 'string' && url.includes('recallai://')) {
          handleAuthUrl(url);
        }
      }
    }
  }).catch(console.error);

  // Deep-link plugin event listener
  onOpenUrl((urls) => {
    console.log('[DeepLink] onOpenUrl triggered:', urls);
    if (urls && Array.isArray(urls)) {
      for (const url of urls) {
        if (typeof url === 'string' && url.includes('recallai://')) {
          handleAuthUrl(url);
        }
      }
    }
  });

  // Single-instance Rust event listener
  listen<string[]>('deep-link-urls', (event) => {
    console.log('[DeepLink] Received deep-link-urls event with payload:', event.payload);
    if (event.payload && Array.isArray(event.payload)) {
      for (const arg of event.payload) {
        if (typeof arg === 'string' && arg.includes('recallai://')) {
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
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </HashRouter>
    </Provider>,
)
