import { Stronghold, Store as StrongholdStore } from '@tauri-apps/plugin-stronghold';
import { load, Store as PluginStore } from '@tauri-apps/plugin-store';
import { appDataDir, join } from '@tauri-apps/api/path';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

const VAULT_NAME = '.recall-keys.app';
const FALLBACK_STORE_NAME = 'keys.json';
const DEFAULT_PASSWORD = 'recall-local-secure-vault-v1';
const CLIENT_NAME = 'recall-client';

let strongholdInstance: Stronghold | null = null;
let strongholdStoreInstance: StrongholdStore | null = null;
let pluginStoreInstance: PluginStore | null = null;
let usingFallback = false;

let initPromise: Promise<void> | null = null;

// Timeout wrapper for IPC commands that might deadlock
export const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

const getStore = async (): Promise<void> => {
  if (strongholdStoreInstance || pluginStoreInstance) {
    return;
  }
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log('Stronghold: Resolving vault path');
        const appData = await appDataDir();
        const vaultPath = await join(appData, VAULT_NAME);
        
        const stronghold = await withTimeout(
          Stronghold.load(vaultPath, DEFAULT_PASSWORD),
          5000,
          "Stronghold.load timed out."
        );
        
        let client;
        try {
          client = await stronghold.loadClient(CLIENT_NAME);
        } catch (e) {
          client = await stronghold.createClient(CLIENT_NAME);
        }
        
        strongholdStoreInstance = client.getStore();
        strongholdInstance = stronghold;
        usingFallback = false;
        console.log('Stronghold: Successfully initialized');
      } catch (error) {
        console.warn('[Keychain] Stronghold failed or timed out. Falling back to plugin-store.', error);
        usingFallback = true;
        pluginStoreInstance = await load(FALLBACK_STORE_NAME, { autoSave: false });
      }
    })();
  }
  
  return initPromise;
};

export const saveApiKey = async (provider: string, key: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  await getStore();
  
  if (usingFallback && pluginStoreInstance) {
    await pluginStoreInstance.set(provider, key);
  } else if (strongholdStoreInstance) {
    const encoder = new TextEncoder();
    await strongholdStoreInstance.insert(provider, encoder.encode(key));
  }
};

export const getApiKey = async (provider: string): Promise<string> => {
  if (!isTauriEnvironment()) return "";
  await getStore();
  
  if (usingFallback && pluginStoreInstance) {
    const data = await pluginStoreInstance.get<string>(provider);
    return data || "";
  } else if (strongholdStoreInstance) {
    try {
      const data = await strongholdStoreInstance.get(provider);
      if (!data) return "";
      return new TextDecoder().decode(new Uint8Array(data as unknown as ArrayBuffer));
    } catch {
      return "";
    }
  }
  return "";
};

export const removeApiKey = async (provider: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  await getStore();
  
  if (usingFallback && pluginStoreInstance) {
    await pluginStoreInstance.delete(provider);
  } else if (strongholdStoreInstance) {
    try {
      await strongholdStoreInstance.remove(provider);
    } catch {}
  }
};

export const saveKeychain = async (): Promise<void> => {
  if (!isTauriEnvironment()) return;
  await getStore();
  
  try {
    if (usingFallback && pluginStoreInstance) {
      await withTimeout(pluginStoreInstance.save(), 5000, "PluginStore save timed out");
    } else if (strongholdInstance) {
      await withTimeout(strongholdInstance.save(), 5000, "Stronghold save timed out");
    }
  } catch (err) {
    console.error("Failed to flush keychain to disk:", err);
  }
};
