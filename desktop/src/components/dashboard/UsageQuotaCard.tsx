import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, KeyRound, HardDrive, FileText, ArrowRight, Check, Settings2 } from 'lucide-react';
import type { AccountOverviewResponse } from '../../api/client';

interface UsageQuotaCardProps {
  overview?: AccountOverviewResponse | null;
}

export function UsageQuotaCard({ overview }: UsageQuotaCardProps) {
  if (!overview) return null;

  const planName = overview.plan?.name || 'Starter Free';
  const aiCredits = overview.usage?.ai_credits;
  const docs = overview.usage?.documents;
  const storage = overview.usage?.storage_mb;
  const isByokActive = overview.byok?.has_configured_providers || (overview.byok?.configured_providers?.length ?? 0) > 0;
  const configuredProviders = overview.byok?.configured_providers ?? [];

  const creditsPercent = aiCredits?.limit ? Math.min(100, Math.round((aiCredits.used / aiCredits.limit) * 100)) : 0;
  const docsPercent = docs?.limit ? Math.min(100, Math.round((docs.used / docs.limit) * 100)) : 0;
  const storagePercent = storage?.limit ? Math.min(100, Math.round((storage.used / storage.limit) * 100)) : 0;

  const formatResetDate = (resetAt?: string | null) => {
    if (!resetAt) return 'next cycle';
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
    <div className="p-4 sm:p-5 rounded-2xl border-2 border-border-default bg-surface shadow-neo flex flex-col justify-between h-full">
      <div className="space-y-3">
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
            <span className="px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-black text-xs flex items-center gap-1.5">
              <KeyRound size={12} strokeWidth={2.5} />
              <span>BYOK Active</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full border border-border-default bg-surface-container text-on-surface font-black text-xs">
              {planName}
            </span>
          )}
        </div>

        {/* 2-Column Sub-Grid for Mode & Quotas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          {/* Mode Card */}
          {isByokActive ? (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between space-y-1.5 min-h-[110px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-500">
                  <Check size={14} strokeWidth={2.5} />
                  <span>BYOK Mode</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                  Waived
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-tight">
                Direct provider billing. Platform generation credits are waived.
              </p>
              {configuredProviders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {configuredProviders.map((provider) => (
                    <span
                      key={provider}
                      className="px-1.5 py-0.5 rounded border border-border-default bg-surface-container text-[10px] font-bold text-on-surface capitalize"
                    >
                      {provider}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-border-default bg-surface-container-low/70 flex flex-col justify-between space-y-1.5 min-h-[110px]">
              <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                <span className="flex items-center gap-1">
                  <Sparkles size={12} className="text-primary" />
                  <span>AI Credits</span>
                </span>
                <span className="font-black">{aiCredits?.used ?? 0} / {aiCredits?.limit ?? 50}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
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

          {/* Quotas Card */}
          <div className="p-3 rounded-xl border border-border-default bg-surface-container-low/70 space-y-2.5 flex flex-col justify-center min-h-[110px]">
            {/* Documents */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <FileText size={12} />
                  <span>Documents</span>
                </span>
                <span className="text-on-surface font-black">
                  {docs?.used ?? 0} / {docs?.limit ?? 10}
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
                <div
                  className="h-full bg-accent-blue transition-all duration-300"
                  style={{ width: `${docsPercent}%` }}
                />
              </div>
            </div>

            {/* Storage */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-on-surface-variant">
                  <HardDrive size={12} />
                  <span>Storage</span>
                </span>
                <span className="text-on-surface font-black">
                  {storage?.used ?? 0} / {storage?.limit ?? 100} MB
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden border border-border-default">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar: Features on left, button on right */}
      <div className="flex items-center justify-between gap-3 pt-3.5 mt-3.5 border-t border-border-default">
        <div className="text-[11px] text-on-surface-variant font-bold truncate">
          Local Vector Search • Markdown & PDF
        </div>

        <Link
          to="/settings"
          className="py-2 px-3.5 rounded-xl border-2 border-border-default bg-surface hover:bg-surface-container text-on-surface font-extrabold text-xs shadow-neo-sm hover:shadow-neo hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all flex items-center justify-center gap-1.5 shrink-0"
        >
          <Settings2 size={14} />
          <span>Manage Plan</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
