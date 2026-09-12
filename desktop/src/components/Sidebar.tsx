import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Book, BrainCircuit, Settings, BarChart3, Menu, NotebookPen } from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthButton } from './AuthButton';

export function Sidebar() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const linkClass = (path: string) => cn(
    "flex items-center rounded-lg transition-all group overflow-hidden whitespace-nowrap shrink-0",
    isExpanded ? "px-3 py-2.5 w-full justify-start gap-3.5" : "w-11 h-11 justify-center mx-auto",
    location.pathname === path 
      ? "bg-primary/10 border border-primary/20 text-primary font-semibold shadow-xs" 
      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-transparent font-medium"
  );

  const iconClass = (path: string) => cn(
    "shrink-0",
    location.pathname === path ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface transition-colors"
  );

  return (
    <aside 
      className={cn(
        "shrink-0 border-r border-border-default bg-surface-container-lowest/60 backdrop-blur-sm flex flex-col h-[calc(100vh-64px)] sticky top-16 overflow-hidden transition-all duration-300 z-40",
        isExpanded ? "w-64" : "w-20"
      )}
    >
      <div className="p-3 flex justify-center border-b border-border-default shrink-0 h-[62px] items-center">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          title={isExpanded ? "Collapse" : "Expand"}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Menu size={20} className="text-on-surface" />
        </button>
      </div>
      
      <div className={cn(
        "flex flex-col gap-1.5 p-3 overflow-y-auto overflow-x-hidden hide-scrollbar flex-1",
        !isExpanded && "items-center"
      )}>
        <Link to="/" className={linkClass("/")} title={!isExpanded ? "Dashboard" : undefined}>
          <Book size={20} strokeWidth={2} className={iconClass("/")} />
          <span className={cn("text-sm", !isExpanded && "hidden")}>Dashboard</span>
        </Link>
        <Link to="/notes" className={linkClass("/notes")} title={!isExpanded ? "Notes" : undefined}>
          <NotebookPen size={20} strokeWidth={2} className={iconClass("/notes")} />
          <span className={cn("text-sm", !isExpanded && "hidden")}>Notes</span>
        </Link>
        <Link to="/review" className={linkClass("/review")} title={!isExpanded ? "Flashcards" : undefined}>
          <BrainCircuit size={20} strokeWidth={2} className={iconClass("/review")} />
          <span className={cn("text-sm", !isExpanded && "hidden")}>Flashcards</span>
        </Link>
        <Link to="/analytics" className={linkClass("/analytics")} title={!isExpanded ? "Analytics" : undefined}>
          <BarChart3 size={20} strokeWidth={2} className={iconClass("/analytics")} />
          <span className={cn("text-sm", !isExpanded && "hidden")}>Analytics</span>
        </Link>
        <Link to="/settings" className={linkClass("/settings")} title={!isExpanded ? "Settings" : undefined}>
          <Settings size={20} strokeWidth={2} className={iconClass("/settings")} />
          <span className={cn("text-sm", !isExpanded && "hidden")}>Settings</span>
        </Link>
      </div>
      <AuthButton isExpanded={isExpanded} />
    </aside>
  );
}
