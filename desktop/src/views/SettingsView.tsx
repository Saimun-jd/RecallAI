import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AIProviderId } from '../store';
import { setActiveProvider, setFallbackToCloud, setShowAttributionTags, setConfiguredProvider } from '../store';
import { loadSettings, saveSetting, saveSettingsStore } from '../api/settingsStore';
import { getApiKey, saveApiKey, removeApiKey, saveKeychain } from '../api/keychain';
import { client } from '../api/client';
import { Loader2, ChevronDown, Keyboard, LifeBuoy, ExternalLink, MessageSquare, Users, Megaphone, ArrowRight, RefreshCcw } from 'lucide-react';
import clsx from 'clsx';

export function SettingsView() {
  const dispatch = useDispatch();
  const { activeProvider, fallbackToCloudEnabled, showAttributionTags } = useSelector((state: RootState) => state.providers);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [loadingStep, setLoadingStep] = useState('Starting initialization...');

  // Local state for keys input
  const [keys, setKeys] = useState<{ [key: string]: string }>({});
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'active' | 'inactive' | null>(null);
  const ollamaHostRef = useRef(keys['ollama_host'] ?? 'http://localhost:11434');

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

        // Load keys from stronghold securely in the background
        const loadKeysBackground = async () => {
          try {
            for (const provider of ['openai', 'gemini', 'groq', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host', 'ollama_host']) {
              const key = await getApiKey(provider);
              if (key) {
                setKeys(prev => ({...prev, [provider]: key}));
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
      } catch (err) {
        console.error("Failed to load settings view", err);
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
    setSaving(true);
    setMessage(null);
    try {
      console.log('Save: starting in-memory settings updates');
      await Promise.all([
        saveSetting('activeProvider', activeProvider),
        saveSetting('fallbackToCloudEnabled', fallbackToCloudEnabled),
        saveSetting('showAttributionTags', showAttributionTags)
      ]);

      const backendKeys: any = {};
      const vaultPromises: Promise<void>[] = [];

      for (const provider of ['openai', 'gemini', 'groq', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host', 'ollama_host']) {
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
          vaultPromises.push(removeApiKey(provider));
          if (['openai', 'gemini', 'groq'].includes(provider)) {
            dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: false }));
            backendKeys[`${provider}_api_key`] = "";
          } else {
            backendKeys[provider] = "";
          }
        }
      }

      console.log('Save: flushing to disk concurrently');
      await Promise.all([
        ...vaultPromises,
        saveSettingsStore()
      ]);

      // Save stronghold vault to disk once
      await saveKeychain();

      // Push keys to backend non-blocking
      if (Object.keys(backendKeys).length > 0) {
        console.log('Save: pushing to backend non-blocking');
        client.saveApiKeys(backendKeys).catch((err) =>
          console.warn('[Settings] Non-critical backend key sync error:', err)
        );
      }
      
      // Push active provider to backend
      client.updateSetting('llm_provider', JSON.stringify({ type: activeProvider })).catch((err) =>
        console.warn('[Settings] Non-critical backend provider sync error:', err)
      );

      setMessage({ text: 'Settings saved successfully', type: 'success' });
    } catch (err: any) {
      console.error('[SettingsView] Save failed at step:', err);
      setMessage({ text: `Save failed: ${err?.message || err || 'Unknown error'}`, type: 'error' });
    } finally {
      console.log('Save: finally block reached');
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
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
    <div className="flex-1 overflow-y-auto bg-surface custom-scrollbar text-on-surface">
      <div className="max-w-[1200px] mx-auto px-8 py-12 flex gap-10">
        
        {/* Left Nav */}
        <nav className="w-64 shrink-0 flex flex-col gap-10">
          <div>
            <p className="text-sm font-extrabold text-black uppercase tracking-tighter mb-4 px-3 border-b-2 border-black pb-1">Account</p>
            <div className="flex flex-col gap-2">
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Profile</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Account Information</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Security</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-extrabold text-black uppercase tracking-tighter mb-4 px-3 border-b-2 border-black pb-1">Learning</p>
            <div className="flex flex-col gap-2">
              <button className="w-full text-left px-3 py-2 neo-border bg-secondary text-white font-black uppercase neo-shadow-sm">AI Preferences</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Study Preferences</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Flashcard Preferences</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-extrabold text-black uppercase tracking-tighter mb-4 px-3 border-b-2 border-black pb-1">Application</p>
            <div className="flex flex-col gap-2">
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Notifications</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Appearance</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Language</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-extrabold text-black uppercase tracking-tighter mb-4 px-3 border-b-2 border-black pb-1">Advanced</p>
            <div className="flex flex-col gap-2">
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Privacy</button>
              <button className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:text-black font-bold uppercase transition-all">Data Export</button>
              <button className="w-full text-left px-3 py-2 text-sm text-error hover:bg-black hover:text-white font-black uppercase transition-all">Delete Account</button>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 max-w-[720px] bg-white neo-border neo-shadow-large p-10">
          <header className="mb-10 border-b-[3px] border-black pb-6">
            <h2 className="text-3xl font-black uppercase text-primary mb-2 tracking-tight">AI Preferences</h2>
            <p className="text-base text-on-surface font-bold">Customize how the Recall AI assistant interacts with your research materials.</p>
          </header>

          {message && (
            <div className={clsx(
              "mb-8 p-4 neo-border font-bold text-sm uppercase flex items-center gap-2",
              message.type === 'success' ? "bg-green-300 text-black" : "bg-red-300 text-black"
            )}>
              {message.text}
            </div>
          )}

          <div className="space-y-12">
            
            {/* Model Selection */}
            <section>
              <label className="block text-sm font-black text-black uppercase mb-3">Preferred AI Model</label>
              <div className="relative max-w-sm">
                <select 
                  value={activeProvider}
                  onChange={(e) => dispatch(setActiveProvider(e.target.value as AIProviderId))}
                  className="w-full appearance-none bg-white neo-border px-4 py-3 text-sm focus:bg-surface-container font-bold cursor-pointer uppercase"
                >
                  <option value="ollama">Ollama (Gemma 3) - Local & Free</option>
                  <option value="gemini">Gemini 2.5 Flash - Cloud & Fast</option>
                  <option value="openai">OpenAI (GPT-4o Mini) - High Quality</option>
                  <option value="groq">Groq (gpt-oss-20b) - Low Latency</option>
                </select>
                <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black font-bold" strokeWidth={3} />
              </div>
              
              {activeProvider === 'ollama' && (
                <div className="mt-4 max-w-sm flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-black uppercase">Ollama Host URL</label>
                    {ollamaStatus === 'checking' && <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase">Checking...</span>}
                    {ollamaStatus === 'active' && <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold uppercase">Active</span>}
                    {ollamaStatus === 'inactive' && <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase">Not Active</span>}
                    <button 
                      type="button" 
                      onClick={() => verifyOllamaHealth(keys['ollama_host'] ?? 'http://localhost:11434')}
                      className="ml-auto text-on-surface-variant hover:text-black transition-colors"
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
                      "w-full bg-white neo-border px-4 py-2 text-sm text-black focus:outline-none focus:ring-0 transition-all font-bold",
                      ollamaStatus === 'inactive' ? "bg-red-50 border-red-500" : "focus:bg-surface-container"
                    )}
                  />
                  <p className="text-[10px] text-on-surface-variant font-bold leading-tight uppercase">Local or remote Ollama server. Must include http://</p>
                </div>
              )}
              
              <p className="text-xs text-on-surface-variant mt-4 italic font-bold">Higher capability models may consume research tokens faster.</p>
            </section>

            {/* Global Settings (Toggles) */}
            <section className="space-y-8 pt-8 border-t-[3px] border-black">
              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-black text-black uppercase">Cloud Fallback</p>
                  <p className="text-sm text-on-surface-variant font-bold">Seamlessly fall back to cloud provider if local Ollama fails.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={fallbackToCloudEnabled}
                    onChange={(e) => dispatch(setFallbackToCloud(e.target.checked))}
                  />
                  <div className={clsx("w-14 h-8 border-[3px] border-black transition-colors flex items-center px-1", fallbackToCloudEnabled ? "bg-secondary" : "bg-white")}>
                    <div className={clsx("w-4 h-4 transition-all duration-200", fallbackToCloudEnabled ? "bg-white translate-x-[26px]" : "bg-black translate-x-0")}></div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-black text-black uppercase">Attribution Tags</p>
                  <p className="text-sm text-on-surface-variant font-bold">Append metadata indicating which model generated flashcards.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={showAttributionTags}
                    onChange={(e) => dispatch(setShowAttributionTags(e.target.checked))}
                  />
                  <div className={clsx("w-14 h-8 border-[3px] border-black transition-colors flex items-center px-1", showAttributionTags ? "bg-secondary" : "bg-white")}>
                    <div className={clsx("w-4 h-4 transition-all duration-200", showAttributionTags ? "bg-white translate-x-[26px]" : "bg-black translate-x-0")}></div>
                  </div>
                </label>
              </div>
            </section>

            {/* Secure API Keys */}
            <section className="pt-8 border-t-[3px] border-black">
              <div className="mb-6">
                <h3 className="text-lg font-black text-black uppercase mb-1">Secure API Keys</h3>
                <p className="text-sm text-on-surface-variant font-bold">Keys never leave your machine (Tauri Stronghold Encrypted).</p>
              </div>
              <div className="space-y-4 max-w-sm">
                {['openai', 'gemini', 'groq'].map((p) => (
                  <div key={p} className="flex flex-col gap-2">
                    <label className="text-xs font-black text-black uppercase">{p} Key</label>
                    <input 
                      type="password" 
                      value={keys[p as AIProviderId] ?? ''}
                      onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                      placeholder={`Enter ${p} key`}
                      className="w-full bg-white neo-border px-4 py-2 text-sm text-black focus:outline-none focus:ring-0 focus:bg-surface-container transition-all font-bold"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Langfuse Telemetry */}
            <section className="pt-8 border-t-[3px] border-black">
              <div className="mb-6">
                <h3 className="text-lg font-black text-black uppercase mb-1">Langfuse Telemetry</h3>
                <p className="text-sm text-on-surface-variant font-bold">Track LLM generations, latency, and costs.</p>
              </div>
              <div className="space-y-4 max-w-sm">
                {['langfuse_secret_key', 'langfuse_public_key', 'langfuse_host'].map((p) => (
                  <div key={p} className="flex flex-col gap-2">
                    <label className="text-xs font-black text-black uppercase">{p.replace(/_/g, ' ')}</label>
                    <input 
                      type={p.includes('secret') ? 'password' : 'text'} 
                      value={keys[p] ?? ''}
                      onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                      placeholder={`Enter ${p}`}
                      className="w-full bg-white neo-border px-4 py-2 text-sm text-black focus:outline-none focus:ring-0 focus:bg-surface-container transition-all font-bold"
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end gap-4 pt-10 mt-10 border-t-[3px] border-black">
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 neo-border bg-white text-black font-black uppercase hover:bg-surface-container transition-all"
              >
                Discard
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 neo-border bg-secondary text-white font-black uppercase neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Right Aside */}
        <aside className="w-72 shrink-0 flex flex-col gap-8 hidden xl:flex">
          {/* Shortcuts */}
          <div className="bg-surface-container-lowest text-on-surface neo-border neo-shadow p-6">
            <div className="flex items-center gap-2 mb-5">
              <Keyboard size={20} className="text-secondary" strokeWidth={3} />
              <h3 className="text-sm font-black uppercase tracking-tight">Shortcuts</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-on-surface-variant">Search</span>
                <kbd className="px-2 py-1 bg-black text-white font-black text-[10px]">⌘ K</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-on-surface-variant">Save</span>
                <kbd className="px-2 py-1 bg-black text-white font-black text-[10px]">⌘ S</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-on-surface-variant">Dashboard</span>
                <kbd className="px-2 py-1 bg-black text-white font-black text-[10px]">⌘ D</kbd>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-surface-container-lowest text-on-surface neo-border neo-shadow p-6">
            <div className="flex items-center gap-2 mb-5">
              <LifeBuoy size={20} className="text-secondary" strokeWidth={3} />
              <h3 className="text-sm font-black uppercase tracking-tight">Support</h3>
            </div>
            <ul className="space-y-4">
              <li><a className="text-xs font-black uppercase hover:text-secondary flex items-center justify-between transition-colors" href="#">Docs <ExternalLink size={16} strokeWidth={2.5} /></a></li>
              <li><a className="text-xs font-black uppercase hover:text-secondary flex items-center justify-between transition-colors" href="#">Chat <MessageSquare size={16} strokeWidth={2.5} /></a></li>
              <li><a className="text-xs font-black uppercase hover:text-secondary flex items-center justify-between transition-colors" href="#">Forum <Users size={16} strokeWidth={2.5} /></a></li>
            </ul>
          </div>

          {/* Update */}
          <div className="bg-surface-container-lowest text-on-surface neo-border neo-shadow p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone size={20} className="text-secondary" strokeWidth={3} />
                <h3 className="text-sm font-black uppercase">Update</h3>
              </div>
              <p className="text-xs font-bold mb-5 leading-relaxed">Claude 3.5 Sonnet is now live for deeper academic reasoning.</p>
              <button className="text-xs font-black uppercase flex items-center gap-2 bg-on-surface text-surface px-3 py-2 neo-border hover:bg-surface-container-high hover:text-on-surface transition-all">
                Release Notes
                <ArrowRight size={16} strokeWidth={3} />
              </button>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
