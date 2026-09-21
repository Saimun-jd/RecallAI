import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, BookOpen, BrainCircuit, MessageSquare, 
  BarChart3, Settings, X, LogOut, NotebookPen, Layers, HelpCircle, RotateCcw, TrendingUp, Activity
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

  // Handle body scroll locking and Escape key dismiss when drawer is open
  React.useEffect(() => {
    if (!isDrawerOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawerOpen, onCloseDrawer]);

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
    { label: 'Progress', path: '/app/progress', icon: TrendingUp },
  ];

  const drawerNavItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: BookOpen },
    { label: 'Knowledge Hub', path: '/app/chat', icon: MessageSquare },
    { label: 'Notes', path: '/notes', icon: NotebookPen },
    { label: 'Review', path: '/app/review', icon: RotateCcw },
    { label: 'Flashcards', path: '/app/flashcards', icon: BrainCircuit },
    { label: 'Quizzes', path: '/app/quizzes', icon: HelpCircle },
    { label: 'Progress', path: '/app/progress', icon: TrendingUp },
    { label: 'LLM Inspection', path: '/llm-inspection', icon: Activity },
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
    if (path === '/app/review' || path === '/review') {
      return location.pathname.startsWith('/review') || location.pathname.startsWith('/app/review');
    }
    if (path === '/app/flashcards' || path === '/flashcards') {
      return location.pathname.startsWith('/app/flashcards') || location.pathname.startsWith('/flashcards');
    }
    if (path === '/app/quizzes' || path === '/quizzes') {
      return location.pathname.startsWith('/app/quizzes') || location.pathname.startsWith('/quizzes');
    }
    if (path === '/app/progress' || path === '/progress' || path === '/analytics') {
      return location.pathname.startsWith('/progress') || location.pathname.startsWith('/app/progress') || location.pathname.startsWith('/analytics') || location.pathname.startsWith('/app/analytics');
    }
    if (path === '/llm-inspection') {
      return location.pathname.startsWith('/llm-inspection');
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
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={onCloseDrawer}
              aria-hidden="true"
            />

            {/* Drawer content */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-4/5 max-w-xs bg-surface border-r-2 border-border-default h-full shadow-neo-lg flex flex-col z-10"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b-2 border-border-default flex items-center justify-between bg-surface-container-low/50">
                <RecallLogo size="md" showAiBadge />
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shadow-neo-xs active:translate-x-[1px] active:translate-y-[1px]"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation links */}
              <div className="p-3 space-y-1 overflow-y-auto flex-1">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-1.5 block">
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
                        'flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg text-sm font-bold transition-all',
                        isActive
                          ? 'bg-primary/10 border-2 border-primary/30 text-primary shadow-neo-sm'
                          : 'text-on-surface hover:bg-surface-container border border-transparent active:translate-x-[1px] active:translate-y-[1px]'
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
                <div className="flex items-center justify-between min-h-[40px]">
                  <span className="text-xs font-bold text-on-surface-variant">Theme</span>
                  <ThemeToggle variant="segmented" />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 border-error/30 bg-error/10 text-error font-bold text-xs hover:bg-error/20 transition-all focus-visible:ring-2 focus-visible:ring-error cursor-pointer shadow-neo-xs active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
