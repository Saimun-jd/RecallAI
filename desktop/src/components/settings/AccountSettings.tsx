import { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Calendar, Key, CheckCircle2, Save, Loader2, Copy, Check } from 'lucide-react';
import { client, type UserPreferencesResponse } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';

export function AccountSettings() {
  const { user, workspace } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Preferences
  const [dailyGoal, setDailyGoal] = useState<number>(20);
  const [initialDailyGoal, setInitialDailyGoal] = useState<number>(20);

  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      try {
        setLoading(true);
        const prefs: UserPreferencesResponse = await client.getUserPreferences();
        if (isMounted && prefs) {
          setDailyGoal(prefs.daily_review_goal || 20);
          setInitialDailyGoal(prefs.daily_review_goal || 20);
        }
      } catch (err: any) {
        console.warn('Failed to load user preferences:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast('success', `${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dailyGoal < 1 || dailyGoal > 500) {
      showToast('error', 'Daily review goal must be between 1 and 500 cards.');
      return;
    }
    try {
      setSavingPrefs(true);
      await client.updateUserPreferences({ daily_review_goal: dailyGoal });
      setInitialDailyGoal(dailyGoal);
      showToast('success', 'Daily review goal saved.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update review goal.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active member';

  const isGoalDirty = dailyGoal !== initialDailyGoal;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Account Identity Section */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-border-default">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center font-black text-lg border-2 border-border-default shadow-xs">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Account Identity</h3>
            <p className="text-xs font-bold text-on-surface-variant">Profile information managed by your Recall AI account</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase text-on-surface-variant flex items-center gap-1.5">
              <UserIcon size={14} className="text-primary" /> Full Name
            </label>
            <div className="flex items-center justify-between bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5">
              <span className="text-sm font-bold text-on-surface">{user?.full_name || 'Recall AI Learner'}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-surface-container text-on-surface-variant rounded border border-border-default">
                Read-only
              </span>
            </div>
          </div>

          {/* Email Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase text-on-surface-variant flex items-center gap-1.5">
              <Mail size={14} className="text-primary" /> Email Address
            </label>
            <div className="flex items-center justify-between bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5">
              <span className="text-sm font-bold text-on-surface font-mono">{user?.email || 'N/A'}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1">
                <CheckCircle2 size={10} /> Verified
              </span>
            </div>
          </div>

          {/* Member Since */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase text-on-surface-variant flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" /> Member Since
            </label>
            <div className="bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5 text-sm font-bold text-on-surface">
              {formattedDate}
            </div>
          </div>

          {/* Workspace ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase text-on-surface-variant flex items-center gap-1.5">
              <Key size={14} className="text-primary" /> Workspace Reference
            </label>
            <div className="flex items-center justify-between bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-mono font-bold text-on-surface truncate max-w-[200px]" title={workspace?.id}>
                {workspace?.name || 'Personal Workspace'}
              </span>
              {workspace?.id && (
                <button
                  type="button"
                  onClick={() => handleCopy(workspace.id, 'Workspace ID')}
                  className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-1"
                  title="Copy Workspace ID"
                >
                  {copiedField === 'Workspace ID' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-default/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-on-surface-variant">
          <span className="font-mono text-[11px] truncate max-w-full sm:max-w-xs" title={user?.id}>User ID: {user?.id}</span>
          <button
            type="button"
            onClick={() => user?.id && handleCopy(user.id, 'User ID')}
            className="font-bold text-[11px] uppercase tracking-wider text-primary hover:underline flex items-center gap-1 cursor-pointer min-h-[32px] self-start sm:self-auto"
          >
            {copiedField === 'User ID' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            Copy User ID
          </button>
        </div>
      </section>

      {/* Learning Preferences Section */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-4 pb-3 border-b-2 border-border-default">
          <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Study & Review Targets</h3>
          <p className="text-xs font-bold text-on-surface-variant">Configure your personalized daily spaced repetition targets</p>
        </div>

        {loading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-sm font-bold text-on-surface-variant">
            <Loader2 size={16} className="animate-spin text-primary" /> Loading preferences...
          </div>
        ) : (
          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface-container-low border-2 border-border-default rounded-lg">
              <div className="max-w-md">
                <p className="text-sm font-black uppercase text-on-surface">Daily Review Card Goal</p>
                <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                  The target number of flashcards and quiz questions to review each day in your Spaced Repetition queue.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-24 bg-surface border-2 border-border-default rounded-lg px-3 py-2 text-sm font-black text-center text-on-surface focus:outline-none focus:border-primary"
                />
                <span className="text-xs font-bold text-on-surface-variant uppercase">Cards / day</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPrefs || !isGoalDirty}
                className="px-5 py-2.5 bg-primary text-on-primary font-black uppercase text-xs rounded-lg border-2 border-primary shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-neo-sm flex items-center gap-2 cursor-pointer"
              >
                {savingPrefs ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {savingPrefs ? 'Saving Target...' : 'Save Target'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
