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
  const [keys, setKeys] = useState<{ [key: string]: string }>({});

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
            for (const provider of ['openai', 'gemini', 'groq', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host']) {
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

      for (const provider of ['openai', 'gemini', 'groq', 'langfuse_secret_key', 'langfuse_public_key', 'langfuse_host']) {
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
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-4" strokeWidth={1.5} />
        <p className="text-on-surface-variant">Loading settings...</p>
        <p className="text-on-surface-variant text-sm mt-2">{loadingStep}</p>
      </div>
    );
  }

  const ProviderCard = ({ id, name, icon: Icon, description, cost, isLocal }: { id: AIProviderId, name: string, icon: any, description: string, cost: string, isLocal?: boolean }) => {
    const isSelected = activeProvider === id;
    return (
      <label className={clsx(
        "relative flex flex-col border rounded-[var(--radius-standard)] p-5 cursor-pointer transition-all duration-200",
        isSelected 
          ? "border-accent-blue/50 bg-accent-blue/5 ring-1 ring-accent-blue/50" 
          : "border-border-default bg-surface-container-low hover:border-border-hover hover:bg-surface-container"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
              isSelected ? "border-accent-blue bg-accent-blue" : "border-outline-variant bg-transparent"
            )}>
              {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
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
              <Icon size={16} className={isSelected ? "text-accent-blue" : "text-on-surface-variant"} strokeWidth={1.5} />
              <span className={clsx("font-semibold", isSelected ? "text-primary" : "text-on-surface")}>{name}</span>
            </div>
          </div>
          {isLocal ? (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
              <ShieldCheck size={10} strokeWidth={1.5} /> Local
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
              <Cloud size={10} strokeWidth={1.5} /> Cloud
            </span>
          )}
        </div>
        <p className="text-sm text-on-surface-variant flex-1 leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-border-default pt-3">
          <span className="text-xs text-on-surface-variant font-medium">Cost Estimate</span>
          <span className={clsx("text-xs font-semibold", isLocal ? "text-accent-blue" : "text-on-surface")}>{cost}</span>
        </div>
      </label>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-surface-container text-on-surface rounded-[var(--radius-standard)] flex items-center justify-center border border-border-default">
          <Settings size={24} strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">AI Settings</h2>
          <p className="text-on-surface-variant text-sm mt-1">Configure your LLM engine and API keys securely.</p>
        </div>
      </div>

      <div className="space-y-8 pb-20">
        
        {/* Provider Selection */}
        <section>
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-2">
            <Cpu size={18} className="text-accent-blue" strokeWidth={1.5} />
            Active AI Provider
          </h3>
          <p className="text-sm text-on-surface-variant mb-6">Select the engine used to extract atomic concepts and generate flashcards.</p>
          
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
              name="Groq(gpt-oss-20b)" 
              icon={Cloud} 
              description="Ultra-low latency inference using gpt-oss-20b. Extremely fast generation speeds."
              cost="Free Tier Available"
            />
          </div>
        </section>

        {/* Global Settings */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-border-default pb-2">
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Settings size={18} className="text-accent-blue" strokeWidth={1.5} />
              Global Preferences
            </h3>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-surface-container-low border border-border-default rounded-[var(--radius-standard)] cursor-pointer hover:border-border-hover transition-all duration-200">
              <div>
                <div className="font-medium text-primary">Cloud Fallback</div>
                <div className="text-sm text-on-surface-variant">If local Ollama fails or is too slow, seamlessly fall back to your configured cloud provider.</div>
              </div>
              <input 
                type="checkbox" 
                checked={fallbackToCloudEnabled} 
                onChange={(e) => dispatch(setFallbackToCloud(e.target.checked))} 
                className="w-5 h-5 rounded-[var(--radius-tag)] border-outline-variant text-accent-blue focus:ring-accent-blue/20 bg-surface-container-lowest" 
              />
            </label>
            <label className="flex items-center justify-between p-4 bg-surface-container-low border border-border-default rounded-[var(--radius-standard)] cursor-pointer hover:border-border-hover transition-all duration-200">
              <div>
                <div className="font-medium text-primary">Attribution Tags</div>
                <div className="text-sm text-on-surface-variant">Append small non-intrusive metadata to flashcards indicating which model generated them.</div>
              </div>
              <input 
                type="checkbox" 
                checked={showAttributionTags} 
                onChange={(e) => dispatch(setShowAttributionTags(e.target.checked))} 
                className="w-5 h-5 rounded-[var(--radius-tag)] border-outline-variant text-accent-blue focus:ring-accent-blue/20 bg-surface-container-lowest" 
              />
            </label>
          </div>
        </section>

        {/* Secure API Keys */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-border-default pb-2">
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Key size={18} className="text-accent-blue" strokeWidth={1.5} />
              Secure API Keys
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
              <ShieldCheck size={14} className="text-accent-blue" strokeWidth={1.5} />
              Tauri Stronghold Encrypted
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mb-6">Keys never leave your machine. They are encrypted using OS-native secure enclaves via Tauri Stronghold.</p>
          
          <div className="space-y-4 max-w-2xl">
            {['openai', 'gemini', 'groq'].map((p) => (
              <div key={p} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-primary capitalize">{p} API Key</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={keys[p as AIProviderId] ?? ''}
                    onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                    placeholder={`Enter ${p} key (e.g. ${p === 'openai' ? 'sk-...' : '...'})`}
                    className="w-full bg-surface-container-low border border-border-default rounded-[var(--radius-standard)] px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue transition-all placeholder:text-on-surface-variant"
                  />
                  {keys[p as AIProviderId] && keys[p as AIProviderId]!.length > 0 && (
                     <div className="absolute right-3 top-1/2 -translate-y-1/2">
                       <ShieldCheck size={16} className="text-accent-blue/50" strokeWidth={1.5} />
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Langfuse Telemetry */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-border-default pb-2">
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Info size={18} className="text-accent-blue" strokeWidth={1.5} />
              Langfuse Telemetry
            </h3>
          </div>
          <p className="text-sm text-on-surface-variant mb-6">Connect to Langfuse to track LLM generations, latency, and costs.</p>
          
          <div className="space-y-4 max-w-2xl">
            {['langfuse_secret_key', 'langfuse_public_key', 'langfuse_host'].map((p) => (
              <div key={p} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-primary capitalize">{p.replace(/_/g, ' ')}</label>
                <div className="relative">
                  <input 
                    type={p.includes('secret') ? 'password' : 'text'} 
                    value={keys[p] ?? ''}
                    onChange={(e) => setKeys(prev => ({ ...prev, [p]: e.target.value }))}
                    placeholder={`Enter ${p}`}
                    className="w-full bg-surface-container-low border border-border-default rounded-[var(--radius-standard)] px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue transition-all placeholder:text-on-surface-variant"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Save Bar */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-surface-container-low border border-border-default px-6 py-4 rounded-[var(--radius-large)] shadow-[var(--shadow-lg)] z-40">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-accent-blue hover:bg-secondary-container text-white px-6 py-2 rounded-[var(--radius-standard)] font-semibold transition-all duration-200 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" strokeWidth={1.5} /> : <Save size={18} strokeWidth={1.5} />}
            Save Preferences
          </button>
          
          {message && (
            <div className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-[var(--radius-standard)] text-sm font-medium animate-in fade-in slide-in-from-bottom-2",
              message.type === 'success' ? "bg-accent-blue/10 text-accent-blue" : "bg-error/10 text-error"
            )}>
              {message.type === 'success' ? <ShieldCheck size={16} strokeWidth={1.5} /> : <Info size={16} strokeWidth={1.5} />}
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
