import { load, Store } from '@tauri-apps/plugin-store';
import type { AIProviderId } from '../store/providersSlice';
import { withTimeout, isTauriEnvironment } from './keychain';

const SETTINGS_FILE = 'settings.json';
let storeInstance: Store | null = null;
let initPromise: Promise<Store> | null = null;

const getStore = async () => {
  if (storeInstance) {
    return storeInstance;
  }
  
  if (!initPromise) {
    initPromise = load(SETTINGS_FILE, { autoSave: false }).then(store => {
      storeInstance = store;
      return store;
    });
  }
  
  return initPromise;
};

export interface AppSettings {
  activeProvider: AIProviderId;
  fallbackToCloudEnabled: boolean;
  showAttributionTags: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  activeProvider: 'ollama',
  fallbackToCloudEnabled: false,
  showAttributionTags: true,
};

export const loadSettings = async (): Promise<AppSettings> => {
  if (!isTauriEnvironment()) {
    console.warn('[SettingsStore] Non-Tauri environment detected. Returning default settings.');
    return DEFAULT_SETTINGS;
  }
  try {
    const store = await getStore();
    const activeProvider = await store.get<AIProviderId>('activeProvider') ?? DEFAULT_SETTINGS.activeProvider;
    const fallbackToCloudEnabled = await store.get<boolean>('fallbackToCloudEnabled') ?? DEFAULT_SETTINGS.fallbackToCloudEnabled;
    const showAttributionTags = await store.get<boolean>('showAttributionTags') ?? DEFAULT_SETTINGS.showAttributionTags;
    return { activeProvider, fallbackToCloudEnabled, showAttributionTags };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
  if (!isTauriEnvironment()) {
    console.warn(`[SettingsStore] Non-Tauri environment detected. Skipping save for setting ${key}.`);
    return;
  }
  try {
    const store = await getStore();
    await store.set(key, value);
    // Manual save must be called separately
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error);
  }
};

export const saveSettingsStore = async () => {
  if (!isTauriEnvironment()) {
    console.warn('[SettingsStore] Non-Tauri environment detected. Skipping Settings Store sync.');
    return;
  }
  try {
    const store = await getStore();
    await withTimeout(
      store.save(),
      10000,
      "store.save() timed out. The file might be locked."
    );
  } catch (error) {
    console.error('Failed to save settings store:', error);
  }
};
