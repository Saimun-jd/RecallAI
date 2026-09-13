import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '../lib/utils';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'recall-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemIsDark]);

  // Apply theme class and data attribute to document root
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
      // Clear any light-mode inline style overrides
      root.style.removeProperty('--color-background');
      root.style.removeProperty('--color-surface');
      root.style.removeProperty('--color-surface-container-lowest');
      root.style.removeProperty('--color-surface-container-low');
      root.style.removeProperty('--color-surface-container');
      root.style.removeProperty('--color-surface-container-high');
      root.style.removeProperty('--color-surface-container-highest');
      root.style.removeProperty('--color-on-background');
      root.style.removeProperty('--color-on-surface');
      root.style.removeProperty('--color-on-surface-variant');
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-outline');
      root.style.removeProperty('--color-outline-variant');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeToggle({ className, variant = 'icon' }: { className?: string; variant?: 'icon' | 'segmented' }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'segmented') {
    return (
      <div 
        role="radiogroup"
        aria-label="Theme selection"
        className={cn(
          "inline-flex items-center p-1 bg-surface-container border border-border-default rounded-lg gap-1",
          className
        )}
      >
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'light'}
          onClick={() => setTheme('light')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
            theme === 'light'
              ? "bg-surface text-on-surface shadow-xs border border-border-default"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Sun size={14} className="text-amber-500" />
          <span>Light</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'dark'}
          onClick={() => setTheme('dark')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
            theme === 'dark'
              ? "bg-surface text-on-surface shadow-xs border border-border-default"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Moon size={14} className="text-blue-400" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={theme === 'system'}
          onClick={() => setTheme('system')}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
            theme === 'system'
              ? "bg-surface text-on-surface shadow-xs border border-border-default"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          <Monitor size={14} />
          <span>System</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "w-9 h-9 flex items-center justify-center rounded-lg border border-border-default bg-surface hover:bg-surface-container text-on-surface transition-all active:scale-95 shadow-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        className
      )}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label={`Current theme is ${resolvedTheme}. Click to switch theme`}
    >
      {resolvedTheme === 'dark' ? (
        <Sun size={17} className="text-amber-400 hover:rotate-45 transition-transform duration-200" />
      ) : (
        <Moon size={17} className="text-on-surface-variant hover:-rotate-12 transition-transform duration-200" />
      )}
    </button>
  );
}
