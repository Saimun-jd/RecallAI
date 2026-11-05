import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Sparkles, Eye, Check } from 'lucide-react';
import { useTheme, type Theme } from '../../hooks/useTheme';
import { client } from '../../api/client';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';

export function AppearanceSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('recall-reduced-motion');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (reducedMotion) {
        document.documentElement.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('reduce-motion');
      }
    }
  }, [reducedMotion]);

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    showToast('success', `Theme switched to ${newTheme.toUpperCase()}`);
    try {
      await client.updateUserPreferences({ theme: newTheme });
    } catch {
      // Non-critical backend sync error ignored
    }
  };

  const handleToggleReducedMotion = (enabled: boolean) => {
    setReducedMotion(enabled);
    localStorage.setItem('recall-reduced-motion', String(enabled));
    showToast('success', enabled ? 'Reduced motion enabled' : 'Smooth animations enabled');
  };

  const themes: { id: Theme; title: string; description: string; icon: any }[] = [
    {
      id: 'light',
      title: 'Light Theme',
      description: 'Clean high-contrast daytime interface with vibrant borders',
      icon: Sun,
    },
    {
      id: 'dark',
      title: 'Dark Theme',
      description: 'Eye-soothing midnight contrast tailored for deep study sessions',
      icon: Moon,
    },
    {
      id: 'system',
      title: 'System Automatic',
      description: 'Synchronizes seamlessly with your operating system settings',
      icon: Monitor,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Theme Selection */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-5 pb-3 border-b-2 border-border-default flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Theme & Color Mode</h3>
            <p className="text-xs font-bold text-on-surface-variant">
              Currently active: <span className="uppercase text-primary font-black">{resolvedTheme}</span> ({theme === 'system' ? 'System sync' : 'Manual'})
            </p>
          </div>
          <span className="text-[11px] font-black uppercase px-2.5 py-1 bg-primary/10 text-primary border border-primary/30 rounded-lg flex items-center gap-1.5">
            <Sparkles size={12} /> Neo-Brutalist System
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleThemeChange(t.id)}
                className={cn(
                  "flex flex-col text-left p-4 rounded-xl border-2 transition-all cursor-pointer relative",
                  isSelected
                    ? "bg-primary/5 border-primary shadow-neo-sm -translate-x-0.5 -translate-y-0.5"
                    : "bg-surface-container-low border-border-default hover:border-primary/50 hover:bg-surface-container"
                )}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mb-3 border-2",
                  isSelected ? "bg-primary text-on-primary border-primary shadow-xs" : "bg-surface text-on-surface-variant border-border-default"
                )}>
                  <Icon size={20} />
                </div>
                <h4 className="font-black uppercase text-sm text-on-surface mb-1">{t.title}</h4>
                <p className="text-xs font-medium text-on-surface-variant leading-relaxed">{t.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Visual Contrast & Typography Preview */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-4 pb-3 border-b-2 border-border-default">
          <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Display & Readability Preview</h3>
          <p className="text-xs font-bold text-on-surface-variant">Real-time rendering of active high-contrast design tokens</p>
        </div>

        <div className="p-4 bg-surface-container-low border-2 border-border-default rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm font-black uppercase text-on-surface">Neo-Brutalist Contrast Architecture</span>
            </div>
            <p className="text-xs font-medium text-on-surface-variant max-w-xl">
              Recall AI enforces minimum 4.5:1 WCAG contrast across all text elements with 2px structural borders and tactile shadows for sustained focus.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border-2 border-border-default rounded-lg text-xs font-mono font-bold text-on-surface shrink-0">
            <Eye size={14} className="text-primary" />
            <span>WCAG AAA Compliant</span>
          </div>
        </div>
      </section>

      {/* Accessibility & Motion Preferences */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-4 pb-3 border-b-2 border-border-default">
          <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Motion & Interaction</h3>
          <p className="text-xs font-bold text-on-surface-variant">Control animations and micro-interactions</p>
        </div>

        <div className="flex items-center justify-between p-4 bg-surface-container-low border-2 border-border-default rounded-xl">
          <div className="pr-4">
            <p className="text-sm font-black uppercase text-on-surface">Reduce Motion & Animations</p>
            <p className="text-xs font-medium text-on-surface-variant mt-0.5">
              Minimizes card flips, dialog transitions, and fluid spring animations across the application.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={reducedMotion}
              onChange={(e) => handleToggleReducedMotion(e.target.checked)}
            />
            <div className={cn(
              "w-12 h-6.5 rounded-full border-2 transition-colors flex items-center px-0.5",
              reducedMotion
                ? "bg-primary border-primary"
                : "bg-surface-container-high border-border-default"
            )}>
              <div className={cn(
                "w-5 h-5 rounded-full transition-all duration-200 shadow-xs",
                reducedMotion
                  ? "bg-on-primary translate-x-[22px]"
                  : "bg-on-surface-variant translate-x-0"
              )} />
            </div>
          </label>
        </div>
      </section>
    </div>
  );
}
