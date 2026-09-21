import React, { createContext, useContext, useState } from 'react';
import { cn } from '../../lib/utils';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setUncontrolledValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={cn('w-full flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1.5 p-1 bg-surface-container border-2 border-border-default rounded-[var(--radius-large)] overflow-x-auto hide-scrollbar max-w-full',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  disabled,
  icon,
  badge,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => context.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-[var(--radius-standard)] transition-all whitespace-nowrap select-none',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        isSelected
          ? 'bg-surface text-on-surface border border-border-default shadow-xs'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface/50 border border-transparent',
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'px-1.5 py-0.2 text-[10px] font-extrabold rounded-full',
            isSelected
              ? 'bg-primary/10 text-primary'
              : 'bg-surface-container-high text-on-surface-variant'
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={cn('mt-4 focus-visible:outline-none animate-in fade-in duration-150', className)}
    >
      {children}
    </div>
  );
}
