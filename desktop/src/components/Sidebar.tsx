import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Book, BrainCircuit, Settings, BarChart3, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { AuthButton } from './AuthButton';

export function Sidebar() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const linkClass = (path: string) => cn(
    "flex items-center rounded-lg transition-all group overflow-hidden whitespace-nowrap shrink-0",
    isExpanded ? "p-3 w-full justify-start gap-4" : "w-10 h-10 justify-center mx-auto",
    location.pathname === path 
      ? "bg-primary/10 border-2 border-on-surface shadow-[2px_2px_0px_0px_#191b23] text-primary" 
      : "text-on-surface hover:bg-surface-container border-2 border-transparent"
  );

  const iconClass = (path: string) => cn(
    "shrink-0",
    location.pathname === path ? "text-primary" : "text-on-surface group-hover:text-primary transition-colors"
  );

  return (
    <aside 
      className={cn(
        "shrink-0 border-r-2 border-on-surface bg-surface-container-low flex flex-col h-[calc(100vh-64px)] sticky top-16 overflow-hidden transition-all duration-300 z-40",
        isExpanded ? "w-64" : "w-20"
      )}
    >
      <div className="p-3 flex justify-center border-b-2 border-on-surface shrink-0 h-[62px] items-center">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors shrink-0"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          <Menu size={20} className="text-on-surface" />
        </button>
      </div>
      
      <div className={cn(
        "flex flex-col gap-2 p-3 overflow-y-auto overflow-x-hidden hide-scrollbar flex-1",
        !isExpanded && "items-center"
      )}>
        <Link to="/" className={linkClass("/")} title={!isExpanded ? "Dashboard" : undefined}>
          <Book size={20} strokeWidth={2.5} className={iconClass("/")} />
          <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>Dashboard</span>
        </Link>
        <Link to="/review" className={linkClass("/review")} title={!isExpanded ? "Flashcards" : undefined}>
          <BrainCircuit size={20} strokeWidth={2.5} className={iconClass("/review")} />
          <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>Flashcards</span>
        </Link>
        <Link to="/analytics" className={linkClass("/analytics")} title={!isExpanded ? "Analytics" : undefined}>
          <BarChart3 size={20} strokeWidth={2.5} className={iconClass("/analytics")} />
          <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>Analytics</span>
        </Link>
        <Link to="/settings" className={linkClass("/settings")} title={!isExpanded ? "Settings" : undefined}>
          <Settings size={20} strokeWidth={2.5} className={iconClass("/settings")} />
          <span className={cn("font-bold text-sm", !isExpanded && "hidden")}>Settings</span>
        </Link>
      </div>
      <AuthButton isExpanded={isExpanded} />
    </aside>
  );
}
