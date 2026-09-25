import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AIProviderId } from '../../store';
import { setActiveProvider, setFallbackToCloud, setShowAttributionTags, setConfiguredProvider } from '../../store';
import {
  client,
  type AccountOverviewResponse,
  type ProviderCredentialItem,
  type TestProviderResponse,
} from '../../api/client';
import {
  Cpu,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  KeyRound,
  ExternalLink,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../hooks/useToast';

interface ProviderCardProps {
  id: string;
  name: string;
  description: string;
  badge: string;
  docUrl: string;
  configuredCredential?: ProviderCredentialItem;
  isActive: boolean;
  onSelectActive: () => void;
  onSaveKey: (provider: string, key: string) => Promise<void>;
  onRemoveKey: (provider: string) => Promise<void>;
}

function ProviderKeyCard({
  id,
  name,
  description,
  badge,
  docUrl,
  configuredCredential,
  isActive,
  onSelectActive,
  onSaveKey,
  onRemoveKey,
}: ProviderCardProps) {
  const { showToast } = useToast();
  const isConfigured = Boolean(configuredCredential);
  const [isEditing, setIsEditing] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestProviderResponse | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await client.testByokProvider(id, keyInput.trim() || undefined);
      setTestResult(res);
      if (res.valid) {
        showToast('success', `${name} connection successful!`);
      } else {
        showToast('error', res.error || `${name} connection failed.`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Connection test failed.');
      setTestResult({ valid: false, provider: id, error: err?.message || 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      showToast('error', 'Please enter a valid API key.');
      return;
    }
    setIsSaving(true);
    try {
      await onSaveKey(id, keyInput.trim());
      // Security: immediately wipe plaintext key from React state
      setKeyInput('');
      setIsEditing(false);
      setTestResult(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "border-2 rounded-xl p-5 flex flex-col justify-between transition-all bg-surface",
        isActive
          ? "border-primary shadow-neo-sm ring-1 ring-primary"
          : "border-border-default hover:border-primary/40 shadow-xs"
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-black uppercase text-sm text-on-surface">{name}</h4>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-surface-container text-on-surface-variant border border-border-default rounded">
              {badge}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isConfigured ? (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1">
                <CheckCircle2 size={10} /> Configured
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-surface-container-high text-on-surface-variant border border-border-default rounded">
                No Key
              </span>
            )}
          </div>
        </div>

        <p className="text-xs font-medium text-on-surface-variant leading-relaxed mb-4">{description}</p>

        {/* Existing credential info */}
        {isConfigured && !isEditing && (
          <div className="p-3 bg-surface-container-low border border-border-default rounded-lg mb-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <KeyRound size={14} className="text-primary" />
              <span className="font-mono font-bold text-on-surface">Key hint: {configuredCredential?.key_hint}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="text-[11px] font-bold uppercase px-2.5 py-1 bg-surface border border-border-default hover:border-primary text-on-surface rounded cursor-pointer transition-colors disabled:opacity-40 flex items-center gap-1"
                title="Test saved key connection"
              >
                {isTesting ? <Loader2 size={10} className="animate-spin" /> : null}
                Test
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-[11px] font-bold uppercase px-2.5 py-1 bg-surface border border-border-default hover:border-primary text-on-surface rounded cursor-pointer transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onRemoveKey(id)}
                className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
                title="Remove API Key"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Test status banner if tested */}
        {testResult && (
          <div
            className={cn(
              "p-2.5 mb-3 rounded-lg border text-xs flex items-center gap-2",
              testResult.valid
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold"
                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 font-medium"
            )}
          >
            {testResult.valid ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
            <span className="truncate">{testResult.valid ? 'Connection verified and operational.' : testResult.error}</span>
          </div>
        )}

        {/* Form to add or replace key */}
        {(!isConfigured || isEditing) && (
          <form onSubmit={handleSave} className="space-y-3 mb-4 p-3 bg-surface-container-low border border-border-default rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase text-on-surface">
                {isConfigured ? 'Replace Secret Key' : 'Enter Secret Key'}
              </label>
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
              >
                Get Key <ExternalLink size={9} />
              </a>
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={`Paste ${name} API key`}
                autoComplete="new-password"
                spellCheck={false}
                className="w-full bg-surface border-2 border-border-default rounded-lg px-3 py-2 pr-10 text-xs font-mono font-medium text-on-surface focus:outline-none focus:border-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 p-1 text-on-surface-variant hover:text-on-surface cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {isConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setKeyInput('');
                    setTestResult(null);
                  }}
                  className="px-3 py-1.5 text-[11px] font-bold uppercase rounded border border-border-default bg-surface hover:bg-surface-container text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleTest}
                disabled={!keyInput.trim() || isTesting}
                className="px-3 py-1.5 text-[11px] font-bold uppercase rounded border border-border-default bg-surface hover:border-primary text-on-surface cursor-pointer disabled:opacity-40 flex items-center gap-1"
              >
                {isTesting && <Loader2 size={10} className="animate-spin" />}
                Test Key
              </button>
              <button
                type="submit"
                disabled={!keyInput.trim() || isSaving}
                className="px-3.5 py-1.5 text-[11px] font-black uppercase rounded bg-primary text-on-primary border-2 border-primary shadow-xs hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} strokeWidth={3} />}
                {isSaving ? 'Encrypting...' : 'Save Vault Key'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Active Selector footer */}
      <div className="pt-3 border-t border-border-default flex items-center justify-between">
        <span className="text-[11px] font-bold text-on-surface-variant">
          {isActive ? 'Currently Active Provider' : 'Select as Active Provider'}
        </span>
        <button
          type="button"
          onClick={onSelectActive}
          disabled={isActive}
          className={cn(
            "px-3 py-1 text-[11px] font-black uppercase rounded-lg border-2 transition-all cursor-pointer",
            isActive
              ? "bg-primary text-on-primary border-primary shadow-neo-sm cursor-default"
              : "bg-surface-container-low text-on-surface border-border-default hover:border-primary hover:bg-surface-container"
          )}
        >
          {isActive ? 'Active' : 'Set Active'}
        </button>
      </div>
    </div>
  );
}

export function AIProviderSettings() {
  const dispatch = useDispatch();
  const { activeProvider, fallbackToCloudEnabled, showAttributionTags } = useSelector(
    (state: RootState) => state.providers
  );
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AccountOverviewResponse | null>(null);
  const [credentials, setCredentials] = useState<ProviderCredentialItem[]>([]);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'active' | 'inactive' | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ov, creds, prefs] = await Promise.all([
        client.getAccountOverview(),
        client.listByokCredentials(),
        client.getUserPreferences().catch(() => null),
      ]);
      setOverview(ov);
      setCredentials(creds);

      if (prefs?.preferred_llm_provider) {
        dispatch(setActiveProvider(prefs.preferred_llm_provider as AIProviderId));
      }

      // Sync redux configured flags
      creds.forEach((c) => {
        if (['openai', 'gemini', 'groq'].includes(c.provider)) {
          dispatch(setConfiguredProvider({ provider: c.provider as AIProviderId, isConfigured: true }));
        }
      });
    } catch (err: any) {
      console.warn('Failed to load AI providers configuration:', err);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const verifyOllamaHealth = async (host: string) => {
    setOllamaStatus('checking');
    try {
      const res = await client.verifyOllama(host);
      setOllamaStatus(res.active ? 'active' : 'inactive');
      if (res.active) {
        showToast('success', 'Ollama local server is active and reachable.');
      } else {
        showToast('error', res.error || 'Ollama server is not reachable.');
      }
    } catch {
      setOllamaStatus('inactive');
      showToast('error', 'Could not reach Ollama at that URL.');
    }
  };

  const handleSetActiveProvider = async (provider: string) => {
    dispatch(setActiveProvider(provider as AIProviderId));
    showToast('success', `Active AI provider switched to ${provider.toUpperCase()}`);
    try {
      await client.updateUserPreferences({ preferred_llm_provider: provider });
    } catch {
      // Ignore background preference sync
    }
  };

  const handleSaveKey = async (provider: string, key: string) => {
    try {
      const cred = await client.saveByokCredential(provider, key);
      setCredentials((prev) => [...prev.filter((c) => c.provider !== provider), cred]);
      if (['openai', 'gemini', 'groq'].includes(provider)) {
        dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: true }));
      }
      showToast('success', `${provider.toUpperCase()} API key saved to encrypted vault.`);
      // Refresh overview
      const ov = await client.getAccountOverview();
      setOverview(ov);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save key.');
      throw err;
    }
  };

  const handleRemoveKey = async (provider: string) => {
    if (!window.confirm(`Are you sure you want to remove the configured API key for ${provider.toUpperCase()}?`)) {
      return;
    }
    try {
      await client.deleteByokCredential(provider);
      setCredentials((prev) => prev.filter((c) => c.provider !== provider));
      if (['openai', 'gemini', 'groq'].includes(provider)) {
        dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: false }));
      }
      showToast('success', `${provider.toUpperCase()} API key removed from vault.`);
      const ov = await client.getAccountOverview();
      setOverview(ov);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to remove key.');
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-on-surface-variant">Loading AI providers & BYOK vault...</p>
      </div>
    );
  }

  const byokAllowed = overview?.byok?.enabled ?? true;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Overview & Active Provider Highlight */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-border-default">
          <div>
            <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Active AI Engine</h3>
            <p className="text-xs font-bold text-on-surface-variant">
              Controls which model processes document extractions, Socratic dialogues, flashcards, and quizzes
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border-2 border-primary/30 rounded-lg">
            <Cpu size={16} className="text-primary shrink-0" />
            <span className="text-xs font-black uppercase text-primary">
              Active: {activeProvider.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Hosted Provider Card */}
        <div
          className={cn(
            "p-5 rounded-xl border-2 transition-all bg-surface-container-low mb-6",
            activeProvider === 'auto'
              ? "border-primary shadow-neo-sm"
              : "border-border-default hover:border-primary/40"
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-black uppercase text-sm text-on-surface">Recall AI Hosted (Default)</h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded">
                  Zero Config Required
                </span>
              </div>
              <p className="text-xs font-medium text-on-surface-variant max-w-xl">
                Uses Recall AI's managed cloud infrastructure. Consumes your monthly AI credits. No personal API keys needed.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleSetActiveProvider('auto')}
              disabled={activeProvider === 'auto'}
              className={cn(
                "px-4 py-2 font-black uppercase text-xs rounded-lg border-2 transition-all shrink-0 cursor-pointer",
                activeProvider === 'auto'
                  ? "bg-primary text-on-primary border-primary shadow-neo-sm cursor-default"
                  : "bg-surface text-on-surface border-border-default hover:border-primary hover:bg-surface-container"
              )}
            >
              {activeProvider === 'auto' ? 'Currently Active' : 'Use Recall AI Hosted'}
            </button>
          </div>
        </div>

        {/* BYOK Entitlement Status Banner */}
        <div className="p-4 rounded-xl border-2 border-border-default bg-surface flex items-start gap-3">
          <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black uppercase text-on-surface">
              {byokAllowed ? 'Bring Your Own Key (BYOK) Enabled' : 'BYOK Upgrade Required'}
            </p>
            <p className="font-medium text-on-surface-variant mt-0.5 leading-relaxed">
              {byokAllowed
                ? 'Your current plan permits configuring personal API keys. BYOK requests bypass monthly credit limits and query provider APIs directly using AES-256-GCM encrypted credentials.'
                : 'Your current plan does not include personal BYOK vault access. Please upgrade to Pro Scholar to unlock custom API keys.'}
            </p>
          </div>
        </div>
      </section>

      {/* Cloud BYOK Providers Grid */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-5 pb-3 border-b-2 border-border-default flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">Cloud Provider Keys</h3>
            <p className="text-xs font-bold text-on-surface-variant">
              Manage your personal OpenAI, Google Gemini, and Groq API keys
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase">
            AES-256-GCM Encrypted
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* OpenAI */}
          <ProviderKeyCard
            id="openai"
            name="OpenAI"
            badge="GPT-4o Mini"
            description="Leading multi-step reasoning model. Ideal for complex synthesis, deep conceptual analysis, and quiz evaluation."
            docUrl="https://platform.openai.com/api-keys"
            configuredCredential={credentials.find((c) => c.provider === 'openai')}
            isActive={activeProvider === 'openai'}
            onSelectActive={() => handleSetActiveProvider('openai')}
            onSaveKey={handleSaveKey}
            onRemoveKey={handleRemoveKey}
          />

          {/* Gemini */}
          <ProviderKeyCard
            id="gemini"
            name="Google Gemini"
            badge="Gemini Flash"
            description="Ultra-fast cloud inference with massive context windows. Excellent for large textbook chunking and flashcards."
            docUrl="https://aistudio.google.com/app/apikey"
            configuredCredential={credentials.find((c) => c.provider === 'gemini')}
            isActive={activeProvider === 'gemini'}
            onSelectActive={() => handleSetActiveProvider('gemini')}
            onSaveKey={handleSaveKey}
            onRemoveKey={handleRemoveKey}
          />

          {/* Groq */}
          <ProviderKeyCard
            id="groq"
            name="Groq LPU"
            badge="gpt-oss-20b"
            description="Next-generation LPU inference delivering sub-second token generation for interactive Socratic drills."
            docUrl="https://console.groq.com/keys"
            configuredCredential={credentials.find((c) => c.provider === 'groq')}
            isActive={activeProvider === 'groq'}
            onSelectActive={() => handleSetActiveProvider('groq')}
            onSaveKey={handleSaveKey}
            onRemoveKey={handleRemoveKey}
          />

          {/* Local Ollama Card */}
          <div
            className={cn(
              "border-2 rounded-xl p-5 flex flex-col justify-between transition-all bg-surface",
              activeProvider === 'ollama'
                ? "border-primary shadow-neo-sm ring-1 ring-primary"
                : "border-border-default hover:border-primary/40 shadow-xs"
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-black uppercase text-sm text-on-surface">Ollama (Local)</h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-surface-container text-on-surface-variant border border-border-default rounded">
                    100% Offline
                  </span>
                </div>
                {ollamaStatus === 'active' ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1">
                    <CheckCircle2 size={10} /> Active
                  </span>
                ) : ollamaStatus === 'checking' ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded">
                    Checking...
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-surface-container-high text-on-surface-variant border border-border-default rounded">
                    Not Checked
                  </span>
                )}
              </div>

              <p className="text-xs font-medium text-on-surface-variant leading-relaxed mb-4">
                Execute open-weight models (Gemma 3, Llama 3) locally on your GPU/CPU with absolute privacy.
              </p>

              <div className="space-y-2 p-3 bg-surface-container-low border border-border-default rounded-lg mb-4">
                <label className="text-[11px] font-black uppercase text-on-surface flex items-center justify-between">
                  <span>Server Host URL</span>
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    Install Ollama <ExternalLink size={9} />
                  </a>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ollamaHost}
                    onChange={(e) => setOllamaHost(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="flex-1 bg-surface border-2 border-border-default rounded-lg px-3 py-2 text-xs font-mono font-medium text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => verifyOllamaHealth(ollamaHost)}
                    disabled={ollamaStatus === 'checking'}
                    className="px-3 py-2 text-xs font-bold uppercase bg-surface border-2 border-border-default hover:border-primary rounded-lg cursor-pointer text-on-surface transition-colors shrink-0 flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={ollamaStatus === 'checking' ? 'animate-spin' : ''} />
                    Test
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border-default flex items-center justify-between">
              <span className="text-[11px] font-bold text-on-surface-variant">Local Private Engine</span>
              <button
                type="button"
                onClick={() => handleSetActiveProvider('ollama')}
                disabled={activeProvider === 'ollama'}
                className={cn(
                  "px-3 py-1 text-[11px] font-black uppercase rounded-lg border-2 transition-all cursor-pointer",
                  activeProvider === 'ollama'
                    ? "bg-primary text-on-primary border-primary shadow-neo-sm cursor-default"
                    : "bg-surface-container-low text-on-surface border-border-default hover:border-primary hover:bg-surface-container"
                )}
              >
                {activeProvider === 'ollama' ? 'Active' : 'Set Active'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Inference & Attribution Options */}
      <section className="bg-surface border-2 border-border-default rounded-xl p-6 shadow-neo-sm">
        <div className="mb-4 pb-3 border-b-2 border-border-default">
          <h3 className="text-lg font-black uppercase text-on-surface tracking-tight">System Resilience & Provenance</h3>
          <p className="text-xs font-bold text-on-surface-variant">Global fallback and metadata attribution controls</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-container-low border-2 border-border-default rounded-xl">
            <div className="pr-4">
              <p className="text-sm font-black uppercase text-on-surface">Automatic Cloud Fallback</p>
              <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                Automatically fall back to hosted cloud AI if your local Ollama instance is unreachable or times out.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={fallbackToCloudEnabled}
                onChange={(e) => dispatch(setFallbackToCloud(e.target.checked))}
              />
              <div className={cn(
                "w-12 h-6.5 rounded-full border-2 transition-colors flex items-center px-0.5",
                fallbackToCloudEnabled
                  ? "bg-primary border-primary"
                  : "bg-surface-container-high border-border-default"
              )}>
                <div className={cn(
                  "w-5 h-5 rounded-full transition-all duration-200 shadow-xs",
                  fallbackToCloudEnabled
                    ? "bg-on-primary translate-x-[22px]"
                    : "bg-on-surface-variant translate-x-0"
                )} />
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-container-low border-2 border-border-default rounded-xl">
            <div className="pr-4">
              <p className="text-sm font-black uppercase text-on-surface">Flashcard Attribution Tags</p>
              <p className="text-xs font-medium text-on-surface-variant mt-0.5">
                Append metadata tags identifying which model generated each flashcard or quiz item.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showAttributionTags}
                onChange={(e) => dispatch(setShowAttributionTags(e.target.checked))}
              />
              <div className={cn(
                "w-12 h-6.5 rounded-full border-2 transition-colors flex items-center px-0.5",
                showAttributionTags
                  ? "bg-primary border-primary"
                  : "bg-surface-container-high border-border-default"
              )}>
                <div className={cn(
                  "w-5 h-5 rounded-full transition-all duration-200 shadow-xs",
                  showAttributionTags
                    ? "bg-on-primary translate-x-[22px]"
                    : "bg-on-surface-variant translate-x-0"
                )} />
              </div>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
