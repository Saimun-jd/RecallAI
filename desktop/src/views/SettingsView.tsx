import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AIProviderId } from '../store';
import { setActiveProvider, setFallbackToCloud, setShowAttributionTags, setConfiguredProvider, setPdfExtractor } from '../store';
import { loadSettings, saveSetting, saveSettingsStore } from '../api/settingsStore';
import { getApiKey, saveApiKey, removeApiKey, saveKeychain } from '../api/keychain';
import { trackSaveOperation } from '../api/saveCoordinator';
import { client, API_BASE } from '../api/client';
import { supabase } from '../lib/supabase';
import { Loader2, ChevronDown, RefreshCcw, Eye, EyeOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../hooks/useToast';
import type { ApiError } from '../api/errors';

export function SettingsView() {
  const dispatch = useDispatch();
  const { activeProvider, fallbackToCloudEnabled, showAttributionTags, pdfExtractor } = useSelector((state: RootState) => state.providers);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [loadingStep, setLoadingStep] = useState('Starting initialization...');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'keys' | 'telemetry' | 'danger'>('general');

  const handleDeleteAllData = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete ALL your data? This will clear your local device and your cloud sync, and cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/delete-all-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      showToast('success', 'All data has been permanently deleted.');
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Failed to delete data', e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Local state for keys input
  const [keys, setKeys] = useState<{ [key: string]: string }>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [verifyingKey, setVerifyingKey] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'active' | 'inactive' | null>(null);
  const ollamaHostRef = useRef(keys['ollama_host'] ?? 'http://localhost:11434');

  const toggleShowKey = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleVerifyKey = async (provider: string) => {
    const keyVal = keys[provider]?.trim();
    if (!keyVal) {
      showToast('error', 'Please enter an API key first to test.');
      return;
    }
    setVerifyingKey(provider);
    try {
      const res = await client.verifyApiKey(provider, keyVal);
      if (res.valid) {
        showToast('success', `${provider.toUpperCase()} API key verified successfully!`);
      } else {
        showToast('error', `Invalid key: ${res.message}`);
      }
    } catch (err: any) {
      showToast('error', err?.userMessage || `Key verification failed: ${err?.message || err}`);
    } finally {
      setVerifyingKey(null);
    }
  };

  // Keep ref in sync
  useEffect(() => {
    ollamaHostRef.current = keys['ollama_host'] ?? 'http://localhost:11434';
  }, [keys['ollama_host']]);

  const verifyOllamaHealth = useCallback(async (host: string) => {
    if (!host) {
      setOllamaStatus(null);
      return;
    }
    setOllamaStatus('checking');
    try {
      const res = await client.verifyOllama(host);
      setOllamaStatus(res.active ? 'active' : 'inactive');
    } catch (e) {
      setOllamaStatus('inactive');
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        setLoadingStep('Loading settings store...');
        const settings = await loadSettings();
        dispatch(setActiveProvider(settings.activeProvider));
        dispatch(setFallbackToCloud(settings.fallbackToCloudEnabled));
        dispatch(setShowAttributionTags(settings.showAttributionTags));
        dispatch(setPdfExtractor(settings.pdfExtractor || 'pymupdf4llm'));

        // Load keys from stronghold securely in the background
        const loadKeysBackground = async () => {
          try {
            for (const provider of ['openai', 'gemini', 'groq', 'datalab_api_key', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host', 'ollama_host']) {
              const key = await getApiKey(provider);
              if (key) {
                setKeys(prev => ({ ...prev, [provider]: key }));
                if (['openai', 'gemini', 'groq'].includes(provider)) {
                  dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: true }));
                }
              }
            }
          } catch (e) {
            console.warn("Failed to load keys in background", e);
          }
        };

        loadKeysBackground();
      } catch (err: any) {
        console.error("Failed to load settings view", err);
        showToast('error', err?.userMessage || 'Failed to load settings.', err?.debugDetail);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [dispatch]);

  // Setup debounce for typing
  useEffect(() => {
    if (activeProvider !== 'ollama') return;

    // Debounce when typing changes the host
    const typingTimer = setTimeout(() => {
      verifyOllamaHealth(keys['ollama_host'] ?? 'http://localhost:11434');
    }, 500);

    return () => {
      clearTimeout(typingTimer);
    };
  }, [keys['ollama_host'], activeProvider, verifyOllamaHealth]);

  const handleSave = async () => {
    if (saving) return;  // Guard against re-entry
    setSaving(true);
    try {
      await trackSaveOperation(async () => {
        console.log('Save: starting in-memory settings updates');
        // Step 1: In-memory IPC writes — fast, must be awaited for correctness
        await Promise.all([
          saveSetting('activeProvider', activeProvider),
          saveSetting('fallbackToCloudEnabled', fallbackToCloudEnabled),
          saveSetting('showAttributionTags', showAttributionTags),
          saveSetting('pdfExtractor', pdfExtractor)
        ]);

        const backendKeys: any = {};
        const vaultPromises: Promise<void>[] = [];

        for (const provider of ['openai', 'gemini', 'groq', 'datalab_api_key', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host', 'ollama_host']) {
          const val = keys[provider];
          if (val && val.trim().length > 0) {
            vaultPromises.push(saveApiKey(provider, val.trim()));
            if (['openai', 'gemini', 'groq'].includes(provider)) {
              dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: true }));
              backendKeys[`${provider}_api_key`] = val.trim();
            } else {
              backendKeys[provider] = val.trim();
            }
          } else if (val === '') {
            vaultPromises.push(
              removeApiKey(provider).catch((err) => {
                console.warn(`[Settings] Failed to remove key for ${provider} (may not exist):`, err);
              })
            );
            if (['openai', 'gemini', 'groq'].includes(provider)) {
              dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: false }));
              backendKeys[`${provider}_api_key`] = "";
            } else {
              backendKeys[provider] = "";
            }
          }
        }

        // Await only the in-memory Stronghold inserts/removes (fast IPC)
        await Promise.all(vaultPromises);

        // Step 2: Flush to disk
        // We MUST await these before allowing the user to proceed.
        // If the user closes the window before these finish, the saves will be aborted 
        // by Tauri shutting down the webview, causing data loss (e.g. API keys not persisting).
        console.log('Save: flushing to disk');
        await Promise.all([
          saveSettingsStore(),
          saveKeychain()
        ]);

        // Step 3: Show success immediately after data is securely written
        showToast('success', 'Settings saved successfully.');

        // If preferred provider requires an API key and none is configured, alert user
        if (activeProvider !== 'ollama' && (!keys[activeProvider] || !keys[activeProvider].trim())) {
          showToast('warning', `Note: ${activeProvider.toUpperCase()} is set as preferred model, but its API key is empty. Please add a key in API Keys tab.`);
        }

        // Push keys to backend non-blocking
        if (Object.keys(backendKeys).length > 0) {
          client.saveApiKeys(backendKeys).catch((err) =>
            console.warn('[Settings] Non-critical backend key sync error:', err)
          );
        }

        // Push active provider to backend
        client.updateSetting('llm_provider', JSON.stringify({ type: activeProvider })).catch((err) =>
          console.warn('[Settings] Non-critical backend provider sync error:', err)
        );

        // Push extractor to backend
        client.updateSetting('pdf_extractor', pdfExtractor).catch((err) =>
          console.warn('[Settings] Non-critical backend extractor sync error:', err)
        );
      });
    } catch (err: any) {
      console.error('[SettingsView] Save failed at step:', err);
      showToast('error', err?.userMessage || `Save failed: ${err?.message || err || 'Unknown error'}`, err?.debugDetail);
    } finally {
      console.log('Save: finally block reached');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" strokeWidth={1.5} />
        <p className="text-on-surface-variant font-bold">Loading settings...</p>
        <p className="text-on-surface-variant text-sm mt-2 font-bold">{loadingStep}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background flex flex-col p-4 md:p-8">
      <div className="max-w-[1000px] mx-auto flex flex-col w-full h-full min-h-0 gap-6">
        
        <header className="shrink-0 border-b-2 border-border-default pb-4">
          <h2 className="text-3xl font-black uppercase text-primary tracking-tight">Settings</h2>
          <p className="text-sm font-bold text-on-surface-variant mt-1">Manage your AI preferences, API keys, and account settings.</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-3 shrink-0 overflow-x-auto pb-2 custom-scrollbar">
          {[
            { id: 'general', label: 'General' },
            { id: 'keys', label: 'API Keys' },
            { id: 'telemetry', label: 'Telemetry' },
            { id: 'danger', label: 'Danger Zone' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                "px-5 py-2 font-black uppercase text-xs sm:text-sm rounded-lg border-2 transition-all whitespace-nowrap cursor-pointer",
                activeTab === tab.id 
                  ? "bg-primary text-on-primary border-primary shadow-neo-sm -translate-x-[1px] -translate-y-[1px]" 
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border-border-default"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-surface-container-lowest border-2 border-border-default rounded-xl shadow-neo p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col relative min-h-0">
          
          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in duration-300 flex-1">
              {/* Model Selection */}
              <section>
                <label className="block text-sm font-black text-on-surface uppercase mb-3">Preferred AI Model</label>
                <div className="relative">
                  <select
                    value={activeProvider}
                    onChange={(e) => dispatch(setActiveProvider(e.target.value as AIProviderId))}
                    className="w-full appearance-none bg-surface-container-low border-2 border-border-default rounded-lg px-4 py-3 text-sm text-on-surface focus:bg-surface-container focus:border-primary font-bold cursor-pointer uppercase transition-all"
                  >
                    <option value="ollama" className="bg-surface text-on-surface">Ollama (Gemma 3) - Local & Free</option>
                    <option value="gemini" className="bg-surface text-on-surface">Gemini Flash - Cloud & Fast</option>
                    <option value="openai" className="bg-surface text-on-surface">OpenAI (GPT-4o Mini) - High Quality</option>
                    <option value="groq" className="bg-surface text-on-surface">Groq (gpt-oss-20b) - Low Latency</option>
                  </select>
                  <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant font-bold" strokeWidth={2.5} />
                </div>

                {activeProvider !== 'ollama' && (!keys[activeProvider] || !keys[activeProvider].trim()) && (
                  <div className="mt-3 p-3.5 bg-amber-500/10 border-2 border-amber-500/40 rounded-lg flex items-start gap-2.5 text-on-surface animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-black uppercase tracking-wide text-amber-500">API Key Not Configured for {activeProvider.toUpperCase()}</p>
                      <p className="font-medium text-on-surface-variant mt-0.5">
                        {activeProvider.toUpperCase()} is currently selected, but no API key is saved. LLM requests will fail until an API key is configured.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('keys')}
                        className="mt-2.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase text-[11px] rounded-md transition-all cursor-pointer shadow-xs"
                      >
                        Configure {activeProvider.toUpperCase()} Key →
                      </button>
                    </div>
                  </div>
                )}

                {activeProvider === 'ollama' && (
                  <div className="mt-4 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-black text-on-surface uppercase">Ollama Host URL</label>
                      {ollamaStatus === 'checking' && <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase">Checking...</span>}
                      {ollamaStatus === 'active' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">Active</span>}
                      {ollamaStatus === 'inactive' && <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold uppercase">Not Active</span>}
                      <button
                        type="button"
                        onClick={() => verifyOllamaHealth(keys['ollama_host'] ?? 'http://localhost:11434')}
                        className="ml-auto text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                        title="Verify Connection"
                      >
                        <RefreshCcw size={14} className={ollamaStatus === 'checking' ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={keys['ollama_host'] ?? 'http://localhost:11434'}
                      onChange={(e) => setKeys(prev => ({ ...prev, ollama_host: e.target.value }))}
                      placeholder="http://localhost:11434"
                      className={clsx(
                        "w-full bg-surface-container-low border-2 border-border-default rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container transition-all font-mono font-medium",
                        ollamaStatus === 'inactive' && "bg-rose-500/10 border-rose-500"
                      )}
                    />
                    <p className="text-[10px] text-on-surface-variant font-bold leading-tight uppercase">Local or remote Ollama server. Must include http://</p>
                  </div>
                )}

                <p className="text-xs text-on-surface-variant mt-4 italic font-medium">Higher capability models may consume research tokens faster.</p>
              </section>

              {/* Global Settings (Toggles) */}
              <section className="space-y-6 pt-6 border-t-2 border-border-default">
                <div className="flex items-center justify-between group">
                  <div className="pr-4">
                    <p className="text-sm font-black text-on-surface uppercase">Cloud Fallback</p>
                    <p className="text-xs text-on-surface-variant font-medium">Seamlessly fall back to cloud provider if local Ollama fails.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={fallbackToCloudEnabled}
                      onChange={(e) => dispatch(setFallbackToCloud(e.target.checked))}
                    />
                    <div className={clsx(
                      "w-12 h-6.5 rounded-full border-2 transition-colors flex items-center px-0.5",
                      fallbackToCloudEnabled 
                        ? "bg-primary border-primary" 
                        : "bg-surface-container-high border-border-default"
                    )}>
                      <div className={clsx(
                        "w-5 h-5 rounded-full transition-all duration-200 shadow-xs",
                        fallbackToCloudEnabled 
                          ? "bg-on-primary translate-x-[22px]" 
                          : "bg-on-surface-variant translate-x-0"
                      )} />
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between group">
                  <div className="pr-4">
                    <p className="text-sm font-black text-on-surface uppercase">Attribution Tags</p>
                    <p className="text-xs text-on-surface-variant font-medium">Append metadata indicating which model generated flashcards.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={showAttributionTags}
                      onChange={(e) => dispatch(setShowAttributionTags(e.target.checked))}
                    />
                    <div className={clsx(
                      "w-12 h-6.5 rounded-full border-2 transition-colors flex items-center px-0.5",
                      showAttributionTags 
                        ? "bg-primary border-primary" 
                        : "bg-surface-container-high border-border-default"
                    )}>
                      <div className={clsx(
                        "w-5 h-5 rounded-full transition-all duration-200 shadow-xs",
                        showAttributionTags 
                          ? "bg-on-primary translate-x-[22px]" 
                          : "bg-on-surface-variant translate-x-0"
                      )} />
                    </div>
                  </label>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between group">
                    <div className="pr-4">
                      <p className="text-sm font-black text-on-surface uppercase">PDF Extractor</p>
                      <p className="text-xs text-on-surface-variant font-medium">Select the backend pipeline used to parse documents.</p>
                    </div>
                    <div className="relative w-52 shrink-0">
                      <select
                        value={pdfExtractor}
                        onChange={(e) => dispatch(setPdfExtractor(e.target.value as any))}
                        className="w-full appearance-none bg-surface-container-low border-2 border-border-default rounded-lg px-3.5 py-2 text-xs text-on-surface focus:bg-surface-container focus:border-primary font-bold cursor-pointer uppercase transition-all"
                      >
                        <option value="pymupdf4llm" className="bg-surface text-on-surface">PyMuPDF4LLM</option>
                        <option value="marker_api" className="bg-surface text-on-surface">Marker (API Key)</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant font-bold" strokeWidth={2.5} />
                    </div>
                  </div>

                  {pdfExtractor === 'marker_api' && (!keys['datalab_api_key'] || !keys['datalab_api_key'].trim()) && (
                    <div className="mt-2.5 p-3.5 bg-amber-500/10 border-2 border-amber-500/40 rounded-lg flex items-start gap-2.5 text-on-surface animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-black uppercase text-amber-500">Datalab Key Missing</p>
                        <p className="font-medium text-on-surface-variant mt-0.5">
                          Marker API extractor requires a Datalab API key to run.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('keys')}
                          className="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase text-[10px] rounded-md transition-all cursor-pointer shadow-xs"
                        >
                          Configure Datalab Key →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-6 animate-in fade-in duration-300 flex-1">
              <div className="mb-2">
                <h3 className="text-xl font-black text-on-surface uppercase mb-1">Secure API Keys</h3>
                <p className="text-sm text-on-surface-variant font-medium">Keys are stored securely in your OS keychain / encrypted store.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['openai', 'gemini', 'groq', 'datalab_api_key'].map((p) => {
                  const label = p === 'datalab_api_key' ? 'Datalab Key' : p.charAt(0).toUpperCase() + p.slice(1) + ' Key';
                  const isConfigured = Boolean(keys[p]?.trim());
                  const isShowing = Boolean(showKeys[p]);
                  const isTesting = verifyingKey === p;
                  return (
                    <div key={p} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-on-surface uppercase">{label}</label>
                        <div className="flex items-center gap-2">
                          {isConfigured ? (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 size={10} className="text-emerald-500" /> Configured
                            </span>
                          ) : (
                            <span className="text-[10px] bg-surface-container text-on-surface-variant border border-border-default px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                              Not Configured
                            </span>
                          )}
                          {['openai', 'gemini', 'groq'].includes(p) && (
                            <button
                              type="button"
                              onClick={() => handleVerifyKey(p)}
                              disabled={!isConfigured || isTesting}
                              className="text-[10px] px-2.5 py-1 font-bold uppercase bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface border border-border-default rounded-md transition-all disabled:opacity-40 disabled:hover:bg-surface-container disabled:hover:text-on-surface cursor-pointer"
                              title="Verify key with provider"
                            >
                              {isTesting ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                              Test
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={isShowing ? 'text' : 'password'}
                          value={keys[p] ?? ''}
                          onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                          placeholder={`Enter ${label.toLowerCase()}`}
                          autoComplete="new-password"
                          spellCheck={false}
                          className="w-full bg-surface-container-low border-2 border-border-default rounded-lg px-4 py-2.5 pr-12 text-sm text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container transition-all font-mono font-medium placeholder:font-sans placeholder:text-on-surface-variant/50"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowKey(p)}
                          className="absolute right-3 p-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                          title={isShowing ? "Hide API key" : "Show API key"}
                        >
                          {isShowing ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-6 animate-in fade-in duration-300 flex-1">
              <div className="mb-2">
                <h3 className="text-xl font-black text-on-surface uppercase mb-1">Langfuse Telemetry</h3>
                <p className="text-sm text-on-surface-variant font-medium">Track LLM generations, latency, and costs.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['langfuse_secret_key', 'langfuse_public_key', 'langfuse_host'].map((p) => {
                  const label = p.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                  const isSecret = p.includes('secret');
                  const isShowing = Boolean(showKeys[p]);
                  const isConfigured = Boolean(keys[p]?.trim());
                  return (
                    <div key={p} className={clsx("flex flex-col gap-2", p === 'langfuse_host' && "col-span-1 md:col-span-2")}>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-on-surface uppercase">{label}</label>
                        {isConfigured && (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-emerald-500" /> Configured
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type={isSecret ? (isShowing ? 'text' : 'password') : 'text'}
                          value={keys[p] ?? ''}
                          onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                          placeholder={`Enter ${label.toLowerCase()}`}
                          autoComplete="new-password"
                          spellCheck={false}
                          className="w-full bg-surface-container-low border-2 border-border-default rounded-lg px-4 py-2.5 pr-12 text-sm text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container transition-all font-mono font-medium placeholder:font-sans placeholder:text-on-surface-variant/50"
                        />
                        {isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleShowKey(p)}
                            className="absolute right-3 p-1.5 text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title={isShowing ? "Hide secret" : "Show secret"}
                          >
                            {isShowing ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-6 animate-in fade-in duration-300 flex-1">
              <div className="mb-2">
                <h3 className="text-xl font-black text-rose-500 uppercase mb-1">Danger Zone</h3>
                <p className="text-sm text-on-surface-variant font-medium">Irreversible actions for your account.</p>
              </div>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-6 bg-rose-500/10 border-2 border-rose-500/40 rounded-xl gap-6">
                <div>
                  <h4 className="font-black text-rose-500 uppercase text-sm mb-2">Delete All Data</h4>
                  <p className="text-xs text-on-surface-variant font-medium max-w-lg leading-relaxed">
                    Permanently wipe all books, topics, and flashcards from your local device and the cloud. This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAllData}
                  disabled={isDeleting}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-black uppercase rounded-lg shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all shrink-0 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting && <Loader2 size={16} className="animate-spin" />}
                  Delete Data
                </button>
              </div>
            </div>
          )}

          {/* Bottom Actions Area inside the card */}
          <div className="flex justify-end gap-3 pt-6 mt-8 border-t-2 border-border-default shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-lg border-2 border-border-default bg-surface-container-low text-on-surface text-sm font-bold uppercase hover:bg-surface-container transition-all cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg border-2 border-primary bg-primary text-on-primary text-sm font-bold uppercase shadow-neo-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-neo-sm flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
