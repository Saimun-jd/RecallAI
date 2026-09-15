import React, { useEffect, useState, useCallback } from 'react';
import { authApi, type User, type Workspace, type LoginPayload, type RegisterPayload } from '../api/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isTauriEnvironment } from '../api/keychain';
import { open as tauriOpen } from '@tauri-apps/plugin-shell';
import { API_BASE } from '../api/client';
import { AuthContext, type AuthStatus } from './AuthContext';

const TOKEN_KEY = 'recall_token';
const ONBOARDING_KEY = 'recall_onboarding_completed';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  });
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(ONBOARDING_KEY) === 'true' : false;
  });

  // Sync token to localStorage
  const saveToken = useCallback((newToken: string | null) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  // Hydrate session on app boot
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);

      // 1. Try FastAPI JWT token if stored
      if (storedToken) {
        try {
          const profile = await authApi.getMe(storedToken);
          if (isMounted) {
            setUser(profile.user);
            setWorkspace(profile.workspace);
            setStatus('authenticated');
            await authApi.setBackendUser(profile.user.id, storedToken);
          }
          return;
        } catch (err) {
          console.warn('[Auth] Stored JWT expired or invalid:', err);
          saveToken(null);
        }
      }

      // 2. Try Supabase session if configured
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            const mappedUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
              avatar_url: session.user.user_metadata?.avatar_url || null,
              created_at: session.user.created_at,
            };
            const mappedWorkspace: Workspace = {
              id: session.user.id,
              owner_id: session.user.id,
              name: 'Personal Workspace',
            };
            setUser(mappedUser);
            setWorkspace(mappedWorkspace);
            saveToken(session.access_token);
            setStatus('authenticated');
            await authApi.setBackendUser(session.user.id, session.access_token);
            return;
          }
        } catch (err) {
          console.warn('[Auth] Supabase session check error:', err);
        }
      }

      // 3. Fallback: unauthenticated
      if (isMounted) {
        setUser(null);
        setWorkspace(null);
        setStatus('unauthenticated');
        await authApi.setBackendUser(null, null);
      }
    };

    initializeAuth();

    // Listen for unauthorized events emitted by client.ts
    const handleUnauthorized = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // Supabase session is still active; do not log out
            return;
          }
        } catch {
          // fall through to wipe
        }
      }
      saveToken(null);
      setUser(null);
      setWorkspace(null);
      setStatus('unauthenticated');
      authApi.setBackendUser(null, null);
    };

    const handleSessionUpdated = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const mappedUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            avatar_url: session.user.user_metadata?.avatar_url || null,
            created_at: session.user.created_at,
          };
          const mappedWorkspace: Workspace = {
            id: session.user.id,
            owner_id: session.user.id,
            name: 'Personal Workspace',
          };
          setUser(mappedUser);
          setWorkspace(mappedWorkspace);
          saveToken(session.access_token);
          setStatus('authenticated');
          await authApi.setBackendUser(session.user.id, session.access_token);
        }
      } catch (err) {
        console.error('[Auth] Error handling auth-session-updated:', err);
      }
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    window.addEventListener('auth-session-updated', handleSessionUpdated);

    // Listen for Supabase OAuth updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        const mappedUser: User = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          avatar_url: session.user.user_metadata?.avatar_url || null,
          created_at: session.user.created_at,
        };
        const mappedWorkspace: Workspace = {
          id: session.user.id,
          owner_id: session.user.id,
          name: 'Personal Workspace',
        };
        setUser(mappedUser);
        setWorkspace(mappedWorkspace);
        saveToken(session.access_token);
        setStatus('authenticated');
        await authApi.setBackendUser(session.user.id, session.access_token);
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
      window.removeEventListener('auth-session-updated', handleSessionUpdated);
      subscription.unsubscribe();
    };
  }, [saveToken]);

  const login = async (payload: LoginPayload): Promise<User> => {
    try {
      if (isSupabaseConfigured) {
        // Route through Supabase so user gets a Supabase JWT → cloud sync works
        const { data, error } = await supabase.auth.signInWithPassword({
          email: payload.email,
          password: payload.password,
        });
        if (error) throw new Error(error.message);
        if (!data.session || !data.user) throw new Error('Authentication failed. Please try again.');

        const mappedUser: User = {
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
          avatar_url: data.user.user_metadata?.avatar_url || null,
          created_at: data.user.created_at,
        };
        const mappedWorkspace: Workspace = {
          id: data.user.id,
          owner_id: data.user.id,
          name: 'Personal Workspace',
        };
        setUser(mappedUser);
        setWorkspace(mappedWorkspace);
        saveToken(data.session.access_token);
        setStatus('authenticated');
        setOnboardingCompleted(true);
        localStorage.setItem(ONBOARDING_KEY, 'true');
        await authApi.setBackendUser(data.user.id, data.session.access_token);
        return mappedUser;
      }

      // Fallback: local FastAPI auth (offline / no Supabase configured)
      const resp = await authApi.login(payload);
      saveToken(resp.access_token);
      setUser(resp.user);
      setWorkspace(resp.workspace);
      setStatus('authenticated');
      setOnboardingCompleted(true);
      localStorage.setItem(ONBOARDING_KEY, 'true');
      await authApi.setBackendUser(resp.user.id, resp.access_token);
      return resp.user;
    } catch (err) {
      setStatus('unauthenticated');
      throw err;
    }
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    try {
      if (isSupabaseConfigured) {
        // Route through Supabase so user gets a Supabase JWT → cloud sync works
        const { data, error } = await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: {
              full_name: payload.full_name || payload.email.split('@')[0],
            },
          },
        });
        if (error) throw new Error(error.message);
        if (!data.user) throw new Error('Registration failed. Please try again.');

        // If email confirmation is required, Supabase returns user but no session
        if (!data.session) {
          setStatus('unauthenticated');
          throw new Error('Account created! Please check your email to confirm your account, then log in.');
        }

        const mappedUser: User = {
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || payload.full_name || data.user.email?.split('@')[0] || 'User',
          avatar_url: data.user.user_metadata?.avatar_url || null,
          created_at: data.user.created_at,
        };
        const mappedWorkspace: Workspace = {
          id: data.user.id,
          owner_id: data.user.id,
          name: 'Personal Workspace',
        };
        setUser(mappedUser);
        setWorkspace(mappedWorkspace);
        saveToken(data.session.access_token);
        setStatus('authenticated');
        // Mark onboarding as pending for new registrants
        setOnboardingCompleted(false);
        localStorage.removeItem(ONBOARDING_KEY);
        await authApi.setBackendUser(data.user.id, data.session.access_token);
        return mappedUser;
      }

      // Fallback: local FastAPI auth (offline / no Supabase configured)
      const resp = await authApi.signup(payload);
      saveToken(resp.access_token);
      setUser(resp.user);
      setWorkspace(resp.workspace);
      setStatus('authenticated');
      // Mark onboarding as pending for new registrants
      setOnboardingCompleted(false);
      localStorage.removeItem(ONBOARDING_KEY);
      await authApi.setBackendUser(resp.user.id, resp.access_token);
      return resp.user;
    } catch (err) {
      setStatus('unauthenticated');
      throw err;
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      throw new Error('Google OAuth is not configured in this environment. Please log in with your email and password.');
    }

    const redirectTo = isTauriEnvironment()
      ? 'http://localhost:8000/auth-success'
      : `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: isTauriEnvironment(),
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      if (isTauriEnvironment()) {
        await tauriOpen(data.url);

        // Fallback poller for desktop: Poll local backend in case deep-link protocol is blocked
        const startTime = Date.now();
        const pollInterval = setInterval(async () => {
          if (Date.now() - startTime > 60000) {
            clearInterval(pollInterval);
            return;
          }
          try {
            const res = await fetch(`${API_BASE}/api/auth/latest-oauth-code`);
            if (res.ok) {
              const payload = await res.json();
              if (payload?.code) {
                clearInterval(pollInterval);
                const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(payload.code);
                if (!exchangeErr) {
                  window.dispatchEvent(new Event('auth-session-updated'));
                }
              }
            }
          } catch {
            // Ignore background polling errors
          }
        }, 1500);
      } else {
        window.location.href = data.url;
      }
    }
  };

  const logout = async (): Promise<void> => {
    const currentToken = token;
    saveToken(null);
    setUser(null);
    setWorkspace(null);
    setStatus('unauthenticated');

    // Notify backend
    await Promise.allSettled([
      authApi.logout(currentToken),
      authApi.setBackendUser(null, null),
      isSupabaseConfigured ? supabase.auth.signOut() : Promise.resolve(),
    ]);
  };

  const completeOnboarding = () => {
    setOnboardingCompleted(true);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  const resetOnboarding = () => {
    setOnboardingCompleted(false);
    localStorage.removeItem(ONBOARDING_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        token,
        status,
        onboardingCompleted,
        login,
        register,
        loginWithGoogle,
        logout,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
