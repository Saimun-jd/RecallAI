import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { open } from '@tauri-apps/plugin-shell';

export function AuthButton({ isExpanded }: { isExpanded: boolean }) {
  const [session, setSession] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const refreshSession = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
      });
    };

    refreshSession();
    window.addEventListener('auth-session-updated', refreshSession);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('auth-session-updated', refreshSession);
    };
  }, []);

  const handleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: 'http://localhost:8000/auth-success',
        },
      });
      if (error) throw error;
      if (data?.url) {
        await open(data.url);
      }
    } catch (err: any) {
      showToast("error", "Login failed", err.message || String(err));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSync = async () => {
    if (!session) return;
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:8000/api/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        showToast("success", "Sync completed successfully");
      } else {
        showToast("error", "Sync failed");
      }
    } catch (err: any) {
      showToast("error", "Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const buttonClass = cn(
    "flex items-center rounded-lg transition-all group overflow-hidden whitespace-nowrap shrink-0",
    isExpanded ? "p-3 w-full justify-start gap-4" : "w-10 h-10 justify-center mx-auto",
    "text-on-surface hover:bg-surface-container border-2 border-transparent"
  );

  const iconClass = "shrink-0 text-on-surface group-hover:text-primary transition-colors";

  if (!session) {
    return (
      <div className="flex flex-col gap-2 p-3 mt-auto border-t-2 border-on-surface shrink-0">
        <button onClick={handleLogin} className={buttonClass} title={!isExpanded ? "Login with Google" : undefined}>
          <LogIn size={20} strokeWidth={2.5} className={iconClass} />
          <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>Login</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 mt-auto border-t-2 border-on-surface shrink-0">
      <button onClick={handleSync} disabled={isSyncing} className={buttonClass} title={!isExpanded ? "Sync Data" : undefined}>
        <RefreshCw size={20} strokeWidth={2.5} className={cn(iconClass, isSyncing && "animate-spin")} />
        <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>
          {isSyncing ? "Syncing..." : "Sync"}
        </span>
      </button>
      <button onClick={handleLogout} className={buttonClass} title={!isExpanded ? "Logout" : undefined}>
        <LogOut size={20} strokeWidth={2.5} className={iconClass} />
        <span className={cn("font-bold text-sm text-error", !isExpanded && "hidden")}>Logout</span>
      </button>
    </div>
  );
}
