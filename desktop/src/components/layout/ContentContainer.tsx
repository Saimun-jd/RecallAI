import React from 'react';
import { cn } from '../../lib/utils';

export interface ContentContainerProps {
  maxWidth?: 'full' | '7xl' | '5xl' | 'readable';
  padding?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ContentContainer({
  maxWidth = '7xl',
  padding = true,
  className,
  children,
}: ContentContainerProps) {
  const maxWidthClasses = {
    full: 'w-full max-w-none',
    '7xl': 'max-w-7xl mx-auto',
    '5xl': 'max-w-5xl mx-auto',
    readable: 'max-w-[760px] mx-auto',
  }[maxWidth];

  return (
    <div
      className={cn(
        'w-full flex-1 min-w-0',
        padding && 'px-4 sm:px-6 lg:px-8 py-6 sm:py-8',
        maxWidthClasses,
        className
      )}
    >
      {children}
    </div>
  );
}
