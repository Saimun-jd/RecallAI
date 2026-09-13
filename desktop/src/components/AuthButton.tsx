import { useState } from 'react';
import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Link } from 'react-router-dom';

export function AuthButton({ isExpanded }: { isExpanded: boolean }) {
  const { user, token, logout } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      showToast("error", "Logout failed", err.message || String(err));
    }
  };

  const handleSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const response = await fetch('http://localhost:8000/api/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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

  if (!user) {
    return (
      <div className="flex flex-col gap-2 p-3 mt-auto border-t-2 border-border-default shrink-0">
        <Link to="/login" className={buttonClass} title={!isExpanded ? "Sign in" : undefined}>
          <LogIn size={20} strokeWidth={2.5} className={iconClass} />
          <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>Sign in</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 mt-auto border-t-2 border-border-default shrink-0">
      <button onClick={handleSync} disabled={isSyncing} className={buttonClass} title={!isExpanded ? "Sync Data" : undefined}>
        <RefreshCw size={20} strokeWidth={2.5} className={cn(iconClass, isSyncing && "animate-spin")} />
        <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>
          {isSyncing ? "Syncing..." : "Sync"}
        </span>
      </button>
      <button onClick={handleLogout} className={buttonClass} title={!isExpanded ? "Logout" : undefined}>
        <LogOut size={20} strokeWidth={2.5} className={iconClass} />
        <span className={cn("font-bold text-sm text-error", !isExpanded && "hidden")}>Sign out</span>
      </button>
    </div>
  );
}
