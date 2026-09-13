import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Key, ArrowRight, Zap, X } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../lib/utils';

export interface UsageLimitBannerProps {
  message?: string;
  onDismiss?: () => void;
  className?: string;
}

export function UsageLimitBanner({
  message = "You've reached your monthly AI credit allowance.",
  onDismiss,
  className,
}: UsageLimitBannerProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        'p-4 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 text-on-surface shadow-neo-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3',
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-1.5 rounded-lg bg-amber-500 text-black shrink-0 mt-0.5 sm:mt-0">
          <AlertTriangle size={16} />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h4 className="font-black text-xs sm:text-sm text-on-surface">
            AI Usage Limit Reached
          </h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {message} You can upgrade your plan for higher monthly limits or bring your own API keys (BYOK) in Settings.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings')}
          className="text-xs gap-1 border-amber-500/40"
        >
          <Key size={13} />
          <span>BYOK</span>
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/pricing')}
          className="text-xs gap-1"
        >
          <Zap size={13} />
          <span>Upgrade</span>
          <ArrowRight size={12} />
        </Button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-on-surface-variant hover:text-on-surface"
            aria-label="Dismiss limit warning"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
