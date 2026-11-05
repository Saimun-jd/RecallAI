import React from 'react';

export function DocumentListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="p-5 rounded-[var(--radius-large)] border-2 border-border-default/60 bg-surface shadow-neo flex flex-col justify-between h-52"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-12 bg-surface-container-high rounded-md" />
              <div className="h-5 w-20 bg-surface-container-high rounded-full" />
            </div>
            <div className="h-6 w-4/5 bg-surface-container-high rounded-md mt-2" />
            <div className="h-4 w-1/2 bg-surface-container rounded-md" />
            <div className="flex gap-4 pt-1">
              <div className="h-4 w-16 bg-surface-container rounded" />
              <div className="h-4 w-20 bg-surface-container rounded" />
            </div>
          </div>
          <div className="pt-3 border-t-2 border-border-default/40 flex justify-between items-center">
            <div className="h-4 w-28 bg-surface-container-high rounded" />
            <div className="h-6 w-6 bg-surface-container-high rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
