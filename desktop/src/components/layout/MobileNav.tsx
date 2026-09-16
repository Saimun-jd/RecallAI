import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, BrainCircuit, MessageSquare, 
  BarChart3, Settings, X, LogOut, NotebookPen, Layers, HelpCircle
} from 'lucide-react';
import { ThemeToggle } from '../../hooks/useTheme';
import { useAuth } from '../../contexts/AuthContext';
import { RecallLogo } from '../brand';
import { cn } from '../../lib/utils';

export interface MobileNavProps {
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  user?: any;
}

export function MobileNav({ isDrawerOpen, onCloseDrawer, user }: MobileNavProps) {
  const location = useLocation();
  const { logout } = useAuth();

  // Hide mobile bottom bar during active review session or quiz attempt for distraction-free study
  const isDistractionFree =
    location.pathname.startsWith('/review') ||
    location.pathname.includes('/study') ||
    location.pathname.includes('/attempt');

  const navItems = [
    { label: 'Home', path: '/app', icon: LayoutDashboard },
    { label: 'Docs', path: '/documents', icon: BookOpen },
    { label: 'Chat', path: '/app/chat', icon: MessageSquare },
    { label: 'Flashcards', path: '/app/flashcards', icon: BrainCircuit },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  ];

  const drawerNavItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: BookOpen },
    { label: 'Knowledge Hub', path: '/app/chat', icon: MessageSquare },
    { label: 'Notes', path: '/notes', icon: NotebookPen },
    { label: 'Flashcards', path: '/app/flashcards', icon: BrainCircuit },
    { label: 'Quizzes', path: '/app/quizzes', icon: HelpCircle },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      onCloseDrawer();
    } catch (e) {
      console.error(e);
    }
  };

  const isItemActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    if (path === '/documents') {
      return location.pathname === '/documents' || location.pathname.startsWith('/app/documents') || location.pathname.startsWith('/books');
    }
    if (path === '/app/chat' || path === '/chat') {
      return location.pathname.startsWith('/chat') || location.pathname.startsWith('/app/chat');
    }
    if (path === '/app/flashcards' || path === '/flashcards') {
      return location.pathname.startsWith('/app/flashcards') || location.pathname.startsWith('/flashcards');
    }
    if (path === '/app/quizzes' || path === '/quizzes') {
      return location.pathname.startsWith('/app/quizzes') || location.pathname.startsWith('/quizzes');
    }
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  return (
    <>
      {/* ─── Mobile Bottom Navigation Bar ─── */}
      {!isDistractionFree && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t-2 border-border-default pb-[env(safe-area-inset-bottom,0px)]"
        >
          <div className="flex items-center justify-around h-14 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all',
                    isActive
                      ? 'text-primary font-black'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  <div
                    className={cn(
                      'p-1 rounded-md transition-all',
                      isActive && 'bg-primary/10 border border-primary/20'
                    )}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="truncate max-w-[64px] mt-0.5">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* ─── Mobile Slide-out Drawer ─── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={onCloseDrawer}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-4/5 max-w-xs bg-surface border-r-2 border-border-default h-full shadow-neo-lg flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b-2 border-border-default flex items-center justify-between bg-surface-container-low/50">
              <RecallLogo size="md" showAiBadge />
              <button
                type="button"
                onClick={onCloseDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-default bg-surface text-on-surface"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation links */}
            <div className="p-3 space-y-1.5 overflow-y-auto flex-1">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-1 block">
                Workspace
              </span>
              {drawerNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onCloseDrawer}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all',
                      isActive
                        ? 'bg-primary/10 border-2 border-primary/30 text-primary shadow-neo-sm'
                        : 'text-on-surface hover:bg-surface-container border border-transparent'
                    )}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t-2 border-border-default bg-surface-container-low/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant">Theme</span>
                <ThemeToggle variant="segmented" />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-error/30 bg-error/10 text-error font-bold text-xs hover:bg-error/20 transition-all"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
