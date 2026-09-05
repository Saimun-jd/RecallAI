import { Stronghold, Store as StrongholdStore } from '@tauri-apps/plugin-stronghold';
import { load, Store as PluginStore } from '@tauri-apps/plugin-store';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { saveApiKey } from './keychain';

const VAULT_NAME = '.recall-keys.app';
const FALLBACK_STORE_NAME = 'keys.json';
const DEFAULT_PASSWORD = 'recall-local-secure-vault-v1';
const CLIENT_NAME = 'recall-client';

export const migrateLegacyKeys = async () => {
  if (localStorage.getItem('legacy-keyring-migrated') === 'true') {
    return;
  }

  try {
    const appData = await appLocalDataDir();
    const vaultPath = await join(appData, VAULT_NAME);

    let stronghold: Stronghold | null = null;
    let strongholdStore: StrongholdStore | null = null;
    let fallbackStore: PluginStore | null = null;

    // Try Stronghold
    try {
      stronghold = await Stronghold.load(vaultPath, DEFAULT_PASSWORD);
      let client;
      try {
        client = await stronghold.loadClient(CLIENT_NAME);
      } catch (e) {
        client = await stronghold.createClient(CLIENT_NAME);
      }
      strongholdStore = client.getStore();
    } catch (error) {
      console.info('[Migration] Stronghold vault could not be loaded or does not exist.', error);
    }

    // Try Fallback
    try {
      fallbackStore = await load(FALLBACK_STORE_NAME, { autoSave: false });
    } catch (error) {
      console.info('[Migration] Fallback store could not be loaded or does not exist.', error);
    }

    const KNOWN_PROVIDERS = ['ollama', 'openai', 'gemini', 'groq'];
    const migratedKeys = new Map<string, string>();

    // 1. Read from Stronghold
    if (strongholdStore) {
      for (const provider of KNOWN_PROVIDERS) {
        try {
          const data = await strongholdStore.get(provider);
          if (data) {
            const key = new TextDecoder().decode(new Uint8Array(data as unknown as ArrayBuffer));
            if (key) migratedKeys.set(provider, key);
          }
        } catch {
          // ignore
        }
      }
    }

    // 2. Read from Fallback Store (overrides Stronghold if exists, or just combines)
    if (fallbackStore) {
      for (const provider of KNOWN_PROVIDERS) {
        try {
          const key = await fallbackStore.get<string>(provider);
          if (key) migratedKeys.set(provider, key);
        } catch {
          // ignore
        }
      }
    }

    // 3. Write to Native Keyring
    for (const [provider, key] of migratedKeys.entries()) {
      await saveApiKey(provider, key);
    }

    // 4. Cleanup old stores if we had anything or at least if we processed them
    const { remove } = await import('@tauri-apps/plugin-fs');
    try {
      await remove(vaultPath);
    } catch {
      // ignore
    }

    try {
      const fallbackPath = await join(appData, FALLBACK_STORE_NAME);
      await remove(fallbackPath);
    } catch {
      // ignore
    }

    localStorage.setItem('legacy-keyring-migrated', 'true');
    console.info(`[Migration] Migrated ${migratedKeys.size} keys to native keyring.`);
  } catch (err) {
    console.error('[Migration] Failed to migrate legacy keys:', err);
  }
};
