import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Book, BrainCircuit, Settings, BarChart3, ChevronLeft, ChevronRight, 
  NotebookPen, LayoutDashboard, MessageSquare, Activity
} from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthButton } from './AuthButton';

export interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);

  const navSections = [
    {
      title: 'Knowledge',
      items: [
        { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
        { label: 'Documents', path: '/documents', icon: Book },
        { label: 'Knowledge Hub', path: '/app/chat', icon: MessageSquare },
        { label: 'Notes', path: '/notes', icon: NotebookPen },
      ],
    },
    {
      title: 'Study & Review',
      items: [
        { label: 'Flashcards', path: '/review', icon: BrainCircuit },
        { label: 'Analytics', path: '/analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'LLM Inspection', path: '/llm-inspection', icon: Activity },
        { label: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

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
    if (path === '/llm-inspection') {
      return location.pathname.startsWith('/llm-inspection');
    }
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const linkClass = (path: string) => {
    const isActive = isItemActive(path);
    return cn(
      'flex items-center rounded-lg transition-all group overflow-hidden whitespace-nowrap shrink-0 font-bold text-xs sm:text-sm select-none',
      isExpanded ? 'px-3 py-2.5 w-full justify-start gap-3' : 'w-10 h-10 justify-center mx-auto',
      isActive
        ? 'bg-primary/10 border-2 border-primary/30 text-primary shadow-neo-sm font-black'
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container border-2 border-transparent'
    );
  };

  const iconClass = (path: string) => {
    const isActive = isItemActive(path);
    return cn(
      'shrink-0 transition-transform duration-120 group-hover:scale-105',
      isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'
    );
  };

  return (
    <aside
      className={cn(
        'shrink-0 border-r-2 border-border-default bg-surface flex flex-col h-[calc(100vh-60px)] sticky top-15 overflow-hidden transition-all duration-200 z-30 select-none',
        isExpanded ? 'w-56 lg:w-60' : 'w-18',
        className
      )}
    >
      {/* Navigation Sections */}
      <div className="flex flex-col gap-4 p-3 overflow-y-auto overflow-x-hidden hide-scrollbar flex-1">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {isExpanded && (
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/70 px-3 py-1 block">
                {section.title}
              </span>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={linkClass(item.path)}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Icon size={18} strokeWidth={2} className={iconClass(item.path)} />
                  <span className={cn('truncate', !isExpanded && 'hidden')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Collapse / Expand Toggle Button */}
      <div className="p-2.5 border-t-2 border-border-default/70 flex items-center justify-between bg-surface-container-low/30 shrink-0">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors shrink-0 text-xs font-bold gap-2',
            isExpanded ? 'w-full py-1.5 px-2 justify-between' : 'w-9 h-9 mx-auto'
          )}
          title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isExpanded ? (
            <>
              <span className="text-xs">Collapse</span>
              <ChevronLeft size={16} />
            </>
          ) : (
            <ChevronRight size={16} />
          )}
        </button>
      </div>

      {/* Legacy Auth button integration at bottom */}
      <AuthButton isExpanded={isExpanded} />
    </aside>
  );
}
