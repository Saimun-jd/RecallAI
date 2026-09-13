import React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-surface border-2 border-border-default shadow-neo rounded-[var(--radius-large)] my-4',
        className
      )}
    >
      {icon && (
        <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-surface-container border-2 border-border-default shadow-neo-sm text-primary mb-4 shrink-0">
          {icon}
        </div>
      )}
      <h3 className="text-lg sm:text-xl font-black text-on-surface tracking-tight mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
