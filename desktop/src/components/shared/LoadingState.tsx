import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SkeletonCard, SkeletonText } from '../ui/Skeleton';

export interface LoadingStateProps {
  variant?: 'page' | 'container' | 'inline' | 'skeleton';
  message?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  variant = 'container',
  message = 'Loading...',
  description,
  className,
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <div className={cn('inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant', className)}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={cn('w-full space-y-4 py-4', className)}>
        <SkeletonCard />
        <SkeletonText lines={3} />
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-background',
          className
        )}
      >
        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface border-2 border-border-default shadow-neo-sm mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
        <h3 className="text-base font-bold text-on-surface">{message}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mt-1">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-center p-8 text-center bg-surface-container-low/30 border border-border-default/60 rounded-[var(--radius-large)] min-h-[200px]',
        className
      )}
    >
      <Loader2 className="w-6 h-6 animate-spin text-primary mb-2.5" />
      <span className="text-sm font-bold text-on-surface">{message}</span>
      {description && (
        <span className="text-xs text-on-surface-variant max-w-xs mt-1">{description}</span>
      )}
    </div>
  );
}
