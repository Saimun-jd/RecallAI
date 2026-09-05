import { getPassword, setPassword, deletePassword } from 'tauri-plugin-keyring-api';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

const SERVICE_NAME = 'com.recall.app';


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

export const saveApiKey = async (provider: string, key: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  await withTimeout(
    setPassword(SERVICE_NAME, provider, key),
    15000,
    "Native Keyring save timed out"
  );
};

export const getApiKey = async (provider: string): Promise<string> => {
  if (!isTauriEnvironment()) return "";
  try {
    const data = await withTimeout(
      getPassword(SERVICE_NAME, provider),
      5000,
      "Native Keyring get timed out"
    );
    return data || "";
  } catch (err) {
    console.info(`[Keychain] Key not found or error for ${provider}`, err);
    return "";
  }
};

export const removeApiKey = async (provider: string): Promise<void> => {
  if (!isTauriEnvironment()) return;
  try {
    await withTimeout(
      deletePassword(SERVICE_NAME, provider),
      15000,
      "Native Keyring delete timed out"
    );
  } catch (err) {
    console.error(`Failed to remove key for ${provider}:`, err);
    throw err;
  }
};

let saveInProgress: Promise<void> | null = null;
export const getActiveKeychainSave = () => saveInProgress;

export const saveKeychain = (): Promise<void> => {
  if (!isTauriEnvironment()) return Promise.resolve();

  // OS Keyring is persistent on write, no separate flush step is required.
  // We keep this function so we don't break existing call sites.
  return Promise.resolve();
};
