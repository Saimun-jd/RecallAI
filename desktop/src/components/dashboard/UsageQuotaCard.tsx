import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, KeyRound, HardDrive, ArrowRight, Check } from 'lucide-react';
import type { AccountOverviewResponse } from '../../api/client';

interface UsageQuotaCardProps {
  overview?: AccountOverviewResponse | null;
}

export function UsageQuotaCard({ overview }: UsageQuotaCardProps) {
  if (!overview) return null;

  const planName = overview.plan?.name || 'Starter Free';
  const aiCredits = overview.usage?.ai_credits;
  const docs = overview.usage?.documents;
  const isByokActive = overview.byok?.has_configured_providers || (overview.byok?.configured_providers?.length ?? 0) > 0;

  const creditsPercent = aiCredits?.limit ? Math.min(100, Math.round((aiCredits.used / aiCredits.limit) * 100)) : 0;
  const docsPercent = docs?.limit ? Math.min(100, Math.round((docs.used / docs.limit) * 100)) : 0;

  const formatResetDate = (resetAt?: string | null) => {
    if (!resetAt) return 'end of billing cycle';
    try {
      return new Date(resetAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'next cycle';
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Sparkles size={17} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-black text-base text-on-surface">Plan & Usage</h3>
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                {planName}
              </span>
            </div>
          </div>

          {isByokActive ? (
            <span className="px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center gap-1">
              <KeyRound size={12} />
              <span>BYOK Active</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md border border-border-default bg-surface-container text-on-surface font-extrabold text-xs">
              {planName}
            </span>
          )}
        </div>

        {/* BYOK Callout or Credit Meter */}
        {isByokActive ? (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600">
              <Check size={14} />
              <span>Zero-Credit BYOK Mode</span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-tight">
              Using custom provider keys ({overview.byok.configured_providers.join(', ')}). Platform generation credits are waived.
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-3 rounded-xl border border-border-default bg-surface-container-low/60">
            <div className="flex items-center justify-between text-xs font-bold text-on-surface">
              <span>Monthly AI Credits</span>
              <span>{aiCredits?.used ?? 0} / {aiCredits?.limit ?? 50} used</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${creditsPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-on-surface-variant">
              <span>{aiCredits?.remaining ?? 50} remaining</span>
              <span>Resets {formatResetDate(aiCredits?.reset_at)}</span>
            </div>
          </div>
        )}

        {/* Document Storage Limit */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <HardDrive size={13} />
              <span>Document Quota</span>
            </span>
            <span className="text-on-surface font-black">
              {docs?.used ?? 0} / {docs?.limit ?? 10} docs
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
            <div
              className="h-full bg-accent-blue transition-all duration-300"
              style={{ width: `${docsPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-border-default">
        <Link
          to="/settings"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-border-default bg-surface text-on-surface font-bold text-xs hover:bg-surface-container transition-all"
        >
          <span>Manage Plan & API Keys</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
