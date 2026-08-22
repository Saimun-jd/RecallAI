import React, { Suspense, lazy } from 'react';

const MarkdownRendererImpl = lazy(() => import('./MarkdownRendererImpl').then(m => ({ default: m.MarkdownRendererImpl })));

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = (props) => {
  return (
    <Suspense fallback={<div className="animate-pulse bg-surface-container h-6 w-full rounded"></div>}>
      <MarkdownRendererImpl {...props} />
    </Suspense>
  );
};
