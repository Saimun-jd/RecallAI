import React, { Suspense, lazy, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

const MarkdownRendererImpl = lazy(() => import('./MarkdownRendererImpl').then(m => ({ default: m.MarkdownRendererImpl })));

interface MarkdownRendererProps {
  content: string;
}

class LocalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Markdown rendering error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-400 border border-red-500/50 p-4 rounded bg-red-500/10 text-xs font-mono break-all whitespace-pre-wrap">
          Failed to render markdown content.
          {'\n\n'}
          {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = (props) => {
  return (
    <LocalErrorBoundary>
      <Suspense fallback={<div className="animate-pulse bg-surface-container h-6 w-full rounded"></div>}>
        <MarkdownRendererImpl {...props} />
      </Suspense>
    </LocalErrorBoundary>
  );
};
