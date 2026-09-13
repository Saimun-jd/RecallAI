import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b-2 border-border-default/60">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Next Action Skeleton */}
      <div className="p-6 sm:p-7 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32 rounded-full" />
            <Skeleton className="h-6 w-72 rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
          </div>
          <Skeleton className="h-11 w-40 rounded-xl shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* 4 Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 sm:p-5 rounded-2xl border-2 border-border-default bg-surface shadow-neo-sm space-y-3">
            <div className="flex justify-between">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <Skeleton className="w-4 h-4 rounded-md" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-4">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo space-y-4">
          <Skeleton className="h-6 w-40 rounded-md" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
