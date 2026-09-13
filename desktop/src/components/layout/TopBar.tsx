import { useDispatch } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, BrainCircuit, Sparkles } from 'lucide-react';
import { StatusBar } from '../StatusBar';
import { AccountMenu } from './AccountMenu';
import { ThemeToggle } from '../../hooks/useTheme';
import { setCommandOpen } from '../../store/commandSlice';
import { cn } from '../../lib/utils';

export interface TopBarProps {
  user?: any;
  bootTime?: number;
  sidecarStatus?: string;
  onMobileMenuOpen?: () => void;
  className?: string;
}

export function TopBar({
  user,
  bootTime = Date.now(),
  sidecarStatus = 'connected',
  onMobileMenuOpen,
  className,
}: TopBarProps) {
  const dispatch = useDispatch();
  const location = useLocation();

  // Determine human-friendly page context title
  const getPageTitle = (pathname: string) => {
    if (pathname === '/' || pathname === '/app') return 'Dashboard';
    if (pathname.startsWith('/books') || pathname.startsWith('/documents')) return 'Knowledge Hub';
    if (pathname.startsWith('/notes')) return 'Notes';
    if (pathname.startsWith('/review')) return 'Daily Review';
    if (pathname.startsWith('/analytics')) return 'Analytics';
    if (pathname.startsWith('/settings')) return 'Settings';
    if (pathname.startsWith('/chat')) return 'Knowledge Hub';
    if (pathname.startsWith('/study')) return 'Study Center';
    return 'Recall AI';
  };

  const isReviewActive = location.pathname.startsWith('/review');

  return (
    <header
      className={cn(
        'sticky top-0 inset-x-0 z-40 h-15 bg-surface/90 backdrop-blur-md border-b-2 border-border-default px-3.5 sm:px-5 flex items-center justify-between gap-3 shrink-0 transition-colors',
        className
      )}
    >
      {/* Left section: Mobile hamburger + Page context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMobileMenuOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-border-default bg-surface hover:bg-surface-container text-on-surface transition-all shrink-0 active:scale-95"
          aria-label="Open mobile navigation"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/app"
            className="font-black tracking-tight text-base sm:text-lg text-primary flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity"
          >
            <span className="w-6 h-6 rounded-md bg-primary text-on-primary flex items-center justify-center text-xs font-black shadow-neo-sm">
              R
            </span>
            <span className="hidden sm:inline">Recall</span>
          </Link>

          <span className="text-on-surface-variant/40 text-sm hidden sm:inline">/</span>

          <span className="font-bold text-sm text-on-surface truncate">
            {getPageTitle(location.pathname)}
          </span>
        </div>
      </div>

      {/* Center/Search: Command Palette Trigger */}
      <div className="hidden sm:flex items-center flex-1 max-w-sm mx-2">
        <button
          type="button"
          onClick={() => dispatch(setCommandOpen(true))}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-border-default bg-surface-container/50 hover:bg-surface-container text-on-surface-variant text-xs font-medium transition-all shadow-xs group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex items-center gap-2 truncate">
            <Search size={14} className="text-on-surface-variant group-hover:text-on-surface" />
            <span className="truncate">Search documents, cards, concepts...</span>
          </span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold text-on-surface-variant bg-surface border border-border-default rounded shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right section: Review Action + Theme + Telemetry + Account */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Mobile search trigger */}
        <button
          type="button"
          onClick={() => dispatch(setCommandOpen(true))}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-border-default bg-surface text-on-surface hover:bg-surface-container transition-all"
          aria-label="Open search command palette"
        >
          <Search size={16} />
        </button>

        {/* Due review quick pill if not already in review */}
        {!isReviewActive && (
          <Link
            to="/review"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Start Spaced Repetition Review"
          >
            <BrainCircuit size={14} className="text-accent-blue" />
            <span>Review</span>
          </Link>
        )}

        {/* System telemetry status */}
        <StatusBar bootTime={bootTime} sidecarStatus={sidecarStatus} />

        {/* Global Theme Toggle */}
        <ThemeToggle />

        {/* Account popover */}
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
