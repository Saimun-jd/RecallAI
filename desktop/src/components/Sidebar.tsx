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
  const COLLAPSED_WIDTH = 64;
  
  // Academic Precision: Soft Minimalism with clear visual hierarchy
  const linkClass = (path: string) => cn(
    "flex items-center gap-3 py-2.5 text-[14px] font-medium transition-all duration-200 ease-out relative",
    "rounded-[var(--radius-standard)]",
    location.pathname === path 
      ? "bg-active-bg text-primary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:bg-accent-blue before:rounded-r" 
      : "text-on-surface hover:bg-hover-bg",
    isCollapsed ? "justify-center" : "px-4",
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
      className="bg-surface-container-low flex flex-col h-full shrink-0 z-10 relative border-r border-border-default min-w-0"
      style={{ 
        width: `${currentWidth}px`, 
        maxWidth: `${currentWidth}px`,
        transition: isResizing ? 'none' : 'width 200ms ease-out, max-width 200ms ease-out' 
      }}
    >
      {/* Header */}
      <div className={cn("border-b border-border-default bg-surface-container-lowest shrink-0", isCollapsed ? "p-4" : "p-6")}>
        {!isCollapsed ? (
          <h1 className="text-2xl font-semibold flex items-center gap-2 tracking-tight text-primary">
            <BrainCircuit className="text-ai-purple w-6 h-6" strokeWidth={2} />
            Recall
          </h1>
        ) : (
          <div className="flex justify-center">
            <BrainCircuit className="text-ai-purple w-6 h-6" strokeWidth={2} />
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 overflow-y-auto overflow-x-hidden", isCollapsed ? "px-2 py-4" : "p-4")}>
        <Link to="/" className={linkClass("/")} title={isCollapsed ? "Knowledge Hub" : undefined}>
          <Book size={20} strokeWidth={1.5} />
          {!isCollapsed && "Knowledge Hub"}
        </Link>
        <Link to="/review" className={linkClass("/review")} title={isCollapsed ? "Flashcards" : undefined}>
          <Zap size={20} strokeWidth={1.5} />
          {!isCollapsed && "Flashcards"}
        </Link>
        <Link to="/analytics" className={linkClass("/analytics")} title={isCollapsed ? "Analytics" : undefined}>
          <BarChart3 size={20} strokeWidth={1.5} />
          {!isCollapsed && "Analytics"}
        </Link>
        <Link to="/settings" className={linkClass("/settings")} title={isCollapsed ? "Settings" : undefined}>
          <Settings size={20} strokeWidth={1.5} />
          {!isCollapsed && "Settings"}
        </Link>
      </nav>
      
      {/* Keyboard Shortcut Hint - Soft Minimalism */}
      {!isCollapsed && (
        <div className="p-4 border-t border-border-default bg-surface-container-lowest shrink-0">
          <button 
            onClick={() => dispatch(setCommandOpen(true))}
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-on-surface-variant bg-surface-container hover:bg-surface-container-high transition-colors border border-border-default rounded-[var(--radius-standard)] cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search size={14} strokeWidth={1.5} className="shrink-0" />
              <span className="truncate">Search</span>
            </span>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <kbd className="bg-surface-container-high px-2 py-0.5 border border-outline-variant rounded-[var(--radius-tag)] text-[11px] font-medium shrink-0">
                Ctrl
              </kbd>
              <span className="text-outline shrink-0">+</span>
              <kbd className="bg-surface-container-high px-2 py-0.5 border border-outline-variant rounded-[var(--radius-tag)] text-[11px] font-medium shrink-0">
                K
              </kbd>
            </div>
          </button>
        </div>
      )}

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-24 w-6 h-6 bg-surface-container-lowest border border-border-default rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all duration-200 shadow-[var(--shadow-default)] z-20"
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronLeft size={14} strokeWidth={2} />}
      </button>
      
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-blue/50 active:bg-accent-blue transition-colors duration-150 z-10",
            isResizing && "bg-accent-blue"
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}
    </div>
  );
}
