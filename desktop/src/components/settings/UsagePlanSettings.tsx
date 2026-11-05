import { useState, useEffect } from 'react';
import {
  client,
  type AccountOverviewResponse,
  type PlanListResponse,
  type UsageSummaryResponse,
} from '../../api/client';
import {
  Zap,
  FileText,
  HardDrive,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  RefreshCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';

export function UsagePlanSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AccountOverviewResponse | null>(null);
  const [plans, setPlans] = useState<PlanListResponse | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ov, pl] = await Promise.all([
        client.getAccountOverview(),
        client.listBillingPlans().catch(() => null),
      ]);
      setOverview(ov);
      setPlans(pl);
    } catch (err: any) {
      console.warn('Failed to load usage & plans:', err);
      showToast('error', 'Failed to load usage metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpgrade = async (planId: string) => {
    try {
      setCheckingOut(true);
      const res = await client.createBillingCheckout(planId);
      if (res.checkout_url) {
        showToast('success', 'Redirecting to secure checkout...');
        // Open checkout URL in new tab or navigate
        window.open(res.checkout_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to initiate checkout session.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your Pro Scholar subscription? Your benefits will remain active until the end of the billing period.')) {
      return;
    }
    try {
      setCanceling(true);
      await client.cancelBillingSubscription(true);
      showToast('success', 'Subscription scheduled for cancellation at period end.');
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to cancel subscription.');
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setReactivating(true);
      await client.reactivateBillingSubscription();
      showToast('success', 'Subscription successfully reactivated!');
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to reactivate subscription.');
    } finally {
      setReactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-on-surface-variant">Loading usage metrics and plan entitlements...</p>
      </div>
    );
  }

  const usage = overview?.usage;
  const currentPlan = overview?.plan;
  const subscription = overview?.subscription;

  // Progress metrics calculation
  const creditsUsed = usage?.ai_credits.used ?? 0;
  const creditsLimit = usage?.ai_credits.limit ?? 50;
  const creditsRemaining = usage?.ai_credits.remaining ?? Math.max(0, creditsLimit - creditsUsed);
  const creditsPercent = Math.min(100, Math.round((creditsUsed / creditsLimit) * 100));

  const docsUsed = usage?.documents.used ?? 0;
  const docsLimit = usage?.documents.limit ?? 10;
  const docsPercent = Math.min(100, Math.round((docsUsed / docsLimit) * 100));

  const storageUsed = usage?.storage_mb.used ?? 0;
  const storageLimit = usage?.storage_mb.limit ?? 50;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  const resetDateFormatted = usage?.ai_credits.reset_at
    ? new Date(usage.ai_credits.reset_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'End of current cycle';

  const isNearCreditLimit = creditsPercent >= 75 && creditsPercent < 100;
  const isCreditLimitReached = creditsPercent >= 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Current Plan Overview Card */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-border-default">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase text-on-surface-variant">Active Entitlement</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/30 rounded">
                Authoritative Backend Tier
              </span>
            </div>
            <h3 className="text-2xl font-black uppercase text-on-surface tracking-tight">
              {currentPlan?.name || 'Starter Free Tier'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl font-black text-on-surface">
                ${((currentPlan?.price_cents ?? 0) / 100).toFixed(0)}
              </span>
              <span className="text-xs font-bold text-on-surface-variant"> / month</span>
            </div>
            {currentPlan?.id === 'free' && (
              <button
                type="button"
                onClick={() => handleUpgrade('pro')}
                disabled={checkingOut}
                className="px-4 py-2 bg-primary text-on-primary font-black uppercase text-xs rounded-lg border-2 border-primary shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {checkingOut ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

        {/* Subscription Status if active */}
        {subscription && (
          <div className="p-4 bg-surface-container-low border-2 border-border-default rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-black uppercase text-on-surface">
                Subscription Status: <span className="text-emerald-500 uppercase">{subscription.status}</span>
              </p>
              <p className="font-medium text-on-surface-variant mt-0.5">
                Current period renews on {new Date(subscription.current_period_end).toLocaleDateString()}.
                {subscription.cancel_at_period_end && (
                  <span className="text-rose-500 font-bold ml-1">
                    (Scheduled for cancellation at period end)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {subscription.cancel_at_period_end ? (
                <button
                  type="button"
                  onClick={handleReactivateSubscription}
                  disabled={reactivating}
                  className="px-3 py-1.5 font-bold uppercase rounded bg-primary text-on-primary text-[11px] border border-primary shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {reactivating && <Loader2 size={10} className="animate-spin mr-1" />}
                  Reactivate Pro
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="px-3 py-1.5 font-bold uppercase rounded bg-surface border border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-[11px] cursor-pointer transition-colors disabled:opacity-50"
                >
                  {canceling && <Loader2 size={10} className="animate-spin mr-1" />}
                  Cancel Subscription
                </button>
              )}
            </div>
          </div>
        )}

        {/* Real-time Usage Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* AI Credits Meter */}
          <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container-low flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-on-surface flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" /> Monthly AI Credits
                </span>
                {isCreditLimitReached ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-rose-500/15 text-rose-500 border border-rose-500/30 rounded">
                    Limit Reached
                  </span>
                ) : isNearCreditLimit ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded">
                    Near Limit
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 rounded">
                    Plenty Left
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-black text-on-surface">{creditsUsed}</span>
                <span className="text-xs font-bold text-on-surface-variant">/ {creditsLimit} used</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-surface rounded-full border border-border-default overflow-hidden my-2">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    isCreditLimitReached
                      ? "bg-rose-500"
                      : isNearCreditLimit
                      ? "bg-amber-500"
                      : "bg-primary"
                  )}
                  style={{ width: `${creditsPercent}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] font-medium text-on-surface-variant flex items-center justify-between pt-2 border-t border-border-default/60">
              <span>{creditsRemaining} credits remaining</span>
              <span>Resets {resetDateFormatted}</span>
            </div>
          </div>

          {/* Document Count Meter */}
          <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container-low flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-on-surface flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-500" /> Stored Documents
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                  {docsPercent}% capacity
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-black text-on-surface">{docsUsed}</span>
                <span className="text-xs font-bold text-on-surface-variant">/ {docsLimit} documents</span>
              </div>

              <div className="w-full h-2.5 bg-surface rounded-full border border-border-default overflow-hidden my-2">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${docsPercent}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] font-medium text-on-surface-variant flex items-center justify-between pt-2 border-t border-border-default/60">
              <span>{Math.max(0, docsLimit - docsUsed)} documents available</span>
              <span>Unlimited in Pro</span>
            </div>
          </div>

          {/* Storage Meter */}
          <div className="p-4 rounded-xl border-2 border-border-default bg-surface-container-low flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase text-on-surface flex items-center gap-1.5">
                  <HardDrive size={14} className="text-purple-500" /> Vault Storage
                </span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">
                  {storagePercent}% used
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-black text-on-surface">{storageUsed.toFixed(1)}</span>
                <span className="text-xs font-bold text-on-surface-variant">/ {storageLimit} MB</span>
              </div>

              <div className="w-full h-2.5 bg-surface rounded-full border border-border-default overflow-hidden my-2">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] font-medium text-on-surface-variant flex items-center justify-between pt-2 border-t border-border-default/60">
              <span>{(storageLimit - storageUsed).toFixed(1)} MB remaining</span>
              <span>2 GB in Pro</span>
            </div>
          </div>
        </div>
      </section>

      {/* Plan Feature Comparison Section */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-5 pb-3 border-b-2 border-border-default">
          <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Available Subscription Plans</h3>
          <p className="text-xs font-bold text-on-surface-variant">Compare entitlement capabilities and upgrade directly</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Starter Free */}
          <div className={cn(
            "p-5 rounded-xl border-2 flex flex-col justify-between bg-surface-container-low",
            currentPlan?.id === 'free' ? "border-primary shadow-neo-sm ring-1 ring-primary" : "border-border-default"
          )}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-black uppercase text-base text-on-surface">Starter Free</h4>
                {currentPlan?.id === 'free' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-primary text-on-primary rounded">
                    Current Plan
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-on-surface-variant mb-4">
                Essential autonomous knowledge synthesis and spaced repetition for individual learners.
              </p>
              <div className="text-2xl font-black text-on-surface mb-4">
                $0 <span className="text-xs font-normal text-on-surface-variant">/ forever</span>
              </div>

              <ul className="space-y-2 text-xs font-medium text-on-surface">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>50 Monthly AI Credits</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Up to 10 Document Uploads (50MB storage)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Spaced Repetition & FSRS Reviews</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Bring Your Own Key (BYOK) Allowed</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 mt-6 border-t border-border-default">
              <button
                type="button"
                disabled
                className="w-full py-2 bg-surface border-2 border-border-default text-on-surface-variant font-bold uppercase text-xs rounded-lg cursor-default"
              >
                Included by Default
              </button>
            </div>
          </div>

          {/* Pro Scholar */}
          <div className={cn(
            "p-5 rounded-xl border-2 flex flex-col justify-between bg-surface-container-low",
            currentPlan?.id === 'pro' ? "border-primary shadow-neo-sm ring-1 ring-primary" : "border-border-default hover:border-primary/50"
          )}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-black uppercase text-base text-on-surface">Pro Scholar</h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-500 text-white rounded font-mono">
                    Popular
                  </span>
                </div>
                {currentPlan?.id === 'pro' && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-primary text-on-primary rounded">
                    Current Plan
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-on-surface-variant mb-4">
                High-volume cognitive pipeline for power students, researchers, and professional certification prep.
              </p>
              <div className="text-2xl font-black text-on-surface mb-4">
                $15 <span className="text-xs font-normal text-on-surface-variant">/ month</span>
              </div>

              <ul className="space-y-2 text-xs font-medium text-on-surface">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span className="font-bold">500 Monthly AI Credits (10x allowance)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Up to 100 Documents & 2,048 MB Storage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Priority Socratic Dialogue & Reasoning Queue</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Full Anki Deck (.apkg) & Markdown Flashcard Exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  <span>Advanced Retention Analytics & Learning Insights</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 mt-6 border-t border-border-default">
              {currentPlan?.id === 'pro' ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black uppercase text-xs rounded-lg cursor-default"
                >
                  Active Subscription
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpgrade('pro')}
                  disabled={checkingOut}
                  className="w-full py-2 bg-primary text-on-primary font-black uppercase text-xs rounded-lg border-2 border-primary shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {checkingOut ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Upgrade to Pro Scholar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
