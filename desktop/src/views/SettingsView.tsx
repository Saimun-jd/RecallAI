import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AIProviderId } from '../store';
import { setActiveProvider, setFallbackToCloud, setShowAttributionTags, setConfiguredProvider } from '../store';
import { loadSettings, saveSetting, saveSettingsStore } from '../api/settingsStore';
import { getApiKey, saveApiKey, removeApiKey, saveKeychain } from '../api/keychain';
import { client } from '../api/client';
import { Settings, Save, Loader2, Key, Cpu, ShieldCheck, HardDrive, Cloud, Info } from 'lucide-react';
import clsx from 'clsx';

export function SettingsView() {
  const dispatch = useDispatch();
  const { activeProvider, fallbackToCloudEnabled, showAttributionTags } = useSelector((state: RootState) => state.providers);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [loadingStep, setLoadingStep] = useState('Starting initialization...');

  // Local state for keys input
  const [keys, setKeys] = useState<{ [key in AIProviderId]?: string }>({});

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
            for (const provider of ['openai', 'gemini', 'groq']) {
              const key = await getApiKey(provider);
              if (key) {
                setKeys(prev => ({...prev, [provider]: key}));
                dispatch(setConfiguredProvider({ provider: provider as AIProviderId, isConfigured: true }));
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

      for (const provider of ['openai', 'gemini', 'groq'] as AIProviderId[]) {
        const val = keys[provider];
        if (val && val.trim().length > 0) {
          vaultPromises.push(saveApiKey(provider, val.trim()));
          dispatch(setConfiguredProvider({ provider, isConfigured: true }));
          backendKeys[`${provider}_api_key`] = val.trim();
        } else if (val === '') {
          vaultPromises.push(removeApiKey(provider));
          dispatch(setConfiguredProvider({ provider, isConfigured: false }));
          backendKeys[`${provider}_api_key`] = "";
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
        <p className="text-zinc-400">Loading settings...</p>
        <p className="text-zinc-500 text-sm mt-2">{loadingStep}</p>
      </div>
    );
  }

  const ProviderCard = ({ id, name, icon: Icon, description, cost, isLocal }: { id: AIProviderId, name: string, icon: any, description: string, cost: string, isLocal?: boolean }) => {
    const isSelected = activeProvider === id;
    return (
      <label className={clsx(
        "relative flex flex-col border rounded-xl p-5 cursor-pointer transition-all duration-200",
        isSelected 
          ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/50" 
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/50"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
              isSelected ? "border-emerald-500 bg-emerald-500" : "border-zinc-600 bg-transparent"
            )}>
              {isSelected && <div className="w-2 h-2 bg-zinc-950 rounded-full" />}
            </div>
            <input 
              type="radio" 
              name="provider" 
              value={id} 
              checked={isSelected} 
              onChange={() => dispatch(setActiveProvider(id))} 
              className="sr-only" 
            />
            <div className="flex items-center gap-2">
              <Icon size={16} className={isSelected ? "text-emerald-400" : "text-zinc-400"} />
              <span className={clsx("font-semibold", isSelected ? "text-emerald-100" : "text-zinc-200")}>{name}</span>
            </div>
          </div>
          {isLocal ? (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck size={10} /> Local
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Cloud size={10} /> Cloud
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-400 flex-1 leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <span className="text-xs text-zinc-500 font-medium">Cost Estimate</span>
          <span className={clsx("text-xs font-semibold", isLocal ? "text-emerald-400" : "text-zinc-300")}>{cost}</span>
        </div>
      </label>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-zinc-800 text-zinc-300 rounded-xl flex items-center justify-center border border-zinc-700/50">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">AI Settings</h2>
          <p className="text-zinc-400 text-sm mt-1">Configure your LLM engine and API keys securely.</p>
        </div>
      </div>

      <div className="space-y-8 pb-20">
        
        {/* Provider Selection */}
        <section>
          <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-2">
            <Cpu size={18} className="text-emerald-500" />
            Active AI Provider
          </h3>
          <p className="text-sm text-zinc-400 mb-6">Select the engine used to extract atomic concepts and generate flashcards.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <ProviderCard 
              id="ollama" 
              name="Ollama (Gemma 3)" 
              icon={HardDrive} 
              description="Runs 100% locally on your machine. Private, secure, and free. Requires sufficient VRAM (8GB+ recommended)."
              cost="Free"
              isLocal
            />
            <ProviderCard 
              id="gemini" 
              name="Gemini 2.5 Flash" 
              icon={Cloud} 
              description="Google's lightning-fast multimodal model. High quality and generous free tier."
              cost="Free Tier Available"
            />
            <ProviderCard 
              id="openai" 
              name="OpenAI (GPT-4o Mini)" 
              icon={Cloud} 
              description="Industry standard for high quality reasoning. Fast and highly capable for complex textbooks."
              cost="~$0.15 / 1M tokens"
            />
            <ProviderCard 
              id="groq" 
              name="Groq (Llama 3.1 8B)" 
              icon={Cloud} 
              description="Ultra-low latency inference using Llama 3.1. Extremely fast generation speeds."
              cost="Free Tier Available"
            />
          </div>
        </section>

        {/* Global Settings */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Settings size={18} className="text-emerald-500" />
              Global Preferences
            </h3>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition">
              <div>
                <div className="font-medium text-zinc-200">Cloud Fallback</div>
                <div className="text-sm text-zinc-400">If local Ollama fails or is too slow, seamlessly fall back to your configured cloud provider.</div>
              </div>
              <input 
                type="checkbox" 
                checked={fallbackToCloudEnabled} 
                onChange={(e) => dispatch(setFallbackToCloud(e.target.checked))} 
                className="w-5 h-5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-950" 
              />
            </label>
            <label className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-700 transition">
              <div>
                <div className="font-medium text-zinc-200">Attribution Tags</div>
                <div className="text-sm text-zinc-400">Append small non-intrusive metadata to flashcards indicating which model generated them.</div>
              </div>
              <input 
                type="checkbox" 
                checked={showAttributionTags} 
                onChange={(e) => dispatch(setShowAttributionTags(e.target.checked))} 
                className="w-5 h-5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-950" 
              />
            </label>
          </div>
        </section>

        {/* Secure API Keys */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Key size={18} className="text-emerald-500" />
              Secure API Keys
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
              <ShieldCheck size={14} className="text-emerald-500/70" />
              Tauri Stronghold Encrypted
            </span>
          </div>
          <p className="text-sm text-zinc-400 mb-6">Keys never leave your machine. They are encrypted using OS-native secure enclaves via Tauri Stronghold.</p>
          
          <div className="space-y-4 max-w-2xl">
            {['openai', 'gemini', 'groq'].map((p) => (
              <div key={p} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-zinc-300 capitalize">{p} API Key</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={keys[p as AIProviderId] ?? ''}
                    onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                    placeholder={`Enter ${p} key (e.g. ${p === 'openai' ? 'sk-...' : '...'})`}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder:text-zinc-700"
                  />
                  {keys[p as AIProviderId] && keys[p as AIProviderId]!.length > 0 && (
                     <div className="absolute right-3 top-1/2 -translate-y-1/2">
                       <ShieldCheck size={16} className="text-emerald-500/50" />
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Save Bar */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900 border border-zinc-800 px-6 py-4 rounded-2xl shadow-2xl z-40">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Preferences
          </button>
          
          {message && (
            <div className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2",
              message.type === 'success' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            )}>
              {message.type === 'success' ? <ShieldCheck size={16} /> : <Info size={16} />}
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
