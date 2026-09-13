import { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  errorDetail?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this data. Please try again.',
  errorDetail,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role="alert"
      className={cn(
        'w-full flex flex-col items-center justify-center text-center p-8 sm:p-10 bg-surface border-2 border-error/40 shadow-neo rounded-[var(--radius-large)] my-4',
        className
      )}
    >
      <div className="w-13 h-13 flex items-center justify-center rounded-2xl bg-error/10 border-2 border-error text-error mb-4 shrink-0 shadow-neo-sm">
        <AlertTriangle size={24} />
      </div>
      <h3 className="text-lg sm:text-xl font-black text-on-surface tracking-tight mb-1.5">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
        {message}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button
            variant="primary"
            onClick={onRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw size={15} />
            <span>Try Again</span>
          </Button>
        )}
        {action}
      </div>

      {errorDetail && (
        <div className="w-full max-w-md mt-6 pt-4 border-t border-border-default/70 text-left">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors py-1"
          >
            <span>Technical Details</span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showDetails && (
            <pre className="mt-2 p-3 bg-surface-container rounded-lg text-[11px] font-mono text-error overflow-x-auto border border-border-default">
              {errorDetail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
