import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCommandOpen } from '../store/commandSlice';
import { Book, BrainCircuit, Settings, Zap, Search, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function Sidebar() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 400;
  const COLLAPSED_WIDTH = 80;
  
  // Neo-Brutalist Navigation Links
  const linkClass = (path: string) => cn(
    "flex items-center gap-3 p-3 font-bold uppercase transition-all duration-200 border-2 border-transparent",
    location.pathname === path 
      ? "bg-blue-500 text-white border-on-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg" 
      : "text-on-surface hover:bg-surface-container-high hover:border-on-background hover:-translate-x-[2px] hover:-translate-y-[2px] rounded-lg",
    isCollapsed ? "justify-center px-0" : "px-4",
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCollapsed) return;
    e.preventDefault();
    setIsResizing(true);
  }, [isCollapsed]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), MAX_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : sidebarWidth;

  return (
    <div 
      className="bg-surface flex flex-col h-full shrink-0 z-10 relative border-r-4 border-on-background shadow-[4px_0px_0px_0px_rgba(0,0,0,1)] min-w-0"
      style={{ 
        width: `${currentWidth}px`, 
        maxWidth: `${currentWidth}px`,
        transition: isResizing ? 'none' : 'width 200ms ease-out, max-width 200ms ease-out' 
      }}
    >
      {/* Header */}
      <div className={cn("border-b-4 border-on-background bg-surface shrink-0 flex items-center", isCollapsed ? "justify-center py-6 px-2" : "p-6")}>
        {!isCollapsed ? (
          <div className="flex items-center space-x-3 w-full">
            <div className="w-10 h-10 border-2 border-on-background bg-secondary-container flex items-center justify-center shrink-0">
              <Book size={24} className="text-on-background" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-on-surface truncate">Recall AI</h1>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 border-2 border-on-background bg-secondary-container flex items-center justify-center shrink-0">
            <Book size={24} className="text-on-background" />
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className={cn("flex-1 space-y-2 overflow-y-auto overflow-x-hidden", isCollapsed ? "px-2 py-6" : "p-4")}>
        <Link to="/" className={linkClass("/")} title={isCollapsed ? "Dashboard" : undefined}>
          <Book size={20} strokeWidth={2.5} className="shrink-0" />
          {!isCollapsed && "Dashboard"}
        </Link>
        <Link to="/review" className={linkClass("/review")} title={isCollapsed ? "Flashcards" : undefined}>
          <BrainCircuit size={20} strokeWidth={2.5} className="shrink-0" />
          {!isCollapsed && "Flashcards"}
        </Link>
        <Link to="/analytics" className={linkClass("/analytics")} title={isCollapsed ? "Analytics" : undefined}>
          <BarChart3 size={20} strokeWidth={2.5} className="shrink-0" />
          {!isCollapsed && "Analytics"}
        </Link>
        <Link to="/settings" className={linkClass("/settings")} title={isCollapsed ? "Settings" : undefined}>
          <Settings size={20} strokeWidth={2.5} className="shrink-0" />
          {!isCollapsed && "Settings"}
        </Link>
      </nav>
      
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-4 top-24 w-8 h-8 bg-surface border-2 border-on-background rounded flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none z-20"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={18} strokeWidth={3} /> : <ChevronLeft size={18} strokeWidth={3} />}
      </button>
      
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors duration-150 z-10",
            isResizing && "bg-primary"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}
    </div>
  );
}
