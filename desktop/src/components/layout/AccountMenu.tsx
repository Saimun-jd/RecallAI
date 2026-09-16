import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, LogOut, Shield } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '../ui/DropdownMenu';
import { Badge } from '../ui/Tag';
import { ThemeToggle } from '../../hooks/useTheme';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

import { useAuth } from '../../contexts/AuthContext';

export interface AccountMenuProps {
  user?: any;
  planName?: string;
  className?: string;
}

export function AccountMenu({ user, planName = 'Free', className }: AccountMenuProps) {
  const { logout: authLogout } = useAuth();
  const [avatarError, setAvatarError] = useState(false);
  const email = user?.email || user?.user_metadata?.email || 'Student';
  const name = user?.full_name || user?.user_metadata?.full_name || email.split('@')[0] || 'Learner';
  const avatarUrl = user?.avatar_url || user?.user_metadata?.avatar_url;

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch (e) {
      console.error('Failed to log out', e);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'relative flex items-center justify-center w-[34px] h-[34px] rounded-full border-2 border-border-default bg-surface hover:ring-2 hover:ring-primary/20 text-on-surface transition-all active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 overflow-hidden cursor-pointer',
          className
        )}
        aria-label={`Account menu for ${name}`}
      >
        {avatarUrl && !avatarError ? (
          <img
            src={avatarUrl}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setAvatarError(true)}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
            <span>{name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" width="w-64">
        {/* User Details Header */}
        <div className="px-4 py-3 border-b border-border-default/70 bg-surface-container-low/50">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-sm text-on-surface truncate">{name}</span>
            <Badge variant="primary" size="xs">
              {planName}
            </Badge>
          </div>
          <p className="text-xs text-on-surface-variant truncate font-medium">{email}</p>
        </div>

        {/* Navigation Items */}
        <div className="py-1">
          <Link to="/settings">
            <DropdownMenuItem icon={<Settings size={15} />}>
              Settings & BYOK
            </DropdownMenuItem>
          </Link>
          <Link to="/analytics">
            <DropdownMenuItem icon={<Shield size={15} />}>
              Progress & Stats
            </DropdownMenuItem>
          </Link>
        </div>

        <DropdownMenuSeparator />

        {/* Theme Setting in Menu */}
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <div className="px-3.5 py-1.5">
          <ThemeToggle variant="segmented" className="w-full justify-between" />
        </div>

        <DropdownMenuSeparator />

        {/* Sign Out */}
        <DropdownMenuItem
          icon={<LogOut size={15} />}
          destructive
          onClick={handleLogout}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
