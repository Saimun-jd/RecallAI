import { useEffect, useCallback, useRef } from 'react';
import { useToast } from './useToast';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriEnvironment } from '../api/keychain';
import { useDispatch } from 'react-redux';
import { setIngestionProgress } from '../store';
import { client } from '../api/client';

const fetchFn = (url: string, options?: any) =>
  isTauriEnvironment() ? tauriFetch(url, options) : window.fetch(url, options);

export function useAutoSync(token: string | null) {
  const { showToast } = useToast();
  const isSyncing = useRef(false);
  const dispatch = useDispatch();

  const triggerSync = useCallback(async (silent = true) => {
    if (!token || isSyncing.current) return;
    
    isSyncing.current = true;
    try {
      const response = await fetchFn('http://localhost:8000/api/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!silent) {
        if (response.ok) {
          showToast("success", "Sync completed successfully");
        } else {
          showToast("error", "Sync failed");
        }
      }

      // Auto-fetch PDFs with progress
      await client.syncPdfsStream(token, (event: any) => {
        if (event.status === 'downloading') {
          dispatch(setIngestionProgress({
             current: event.current,
             total: event.total,
             topic: `Downloading ${event.title}`,
             percentage: event.percentage,
             status: 'processing'
          }));
        } else if (event.status === 'complete' || event.status === 'error') {
          setTimeout(() => {
             dispatch(setIngestionProgress(null));
          }, 1000);
        }
      });
      
    } catch (err: any) {
      if (!silent) {
        showToast("error", "Sync failed: " + err.message);
      } else {
        console.error("Background sync failed:", err);
      }
    } finally {
      isSyncing.current = false;
    }
  }, [token, showToast]);

  useEffect(() => {
    if (!token) return;

    // 1. Sync on login/mount
    triggerSync(true);

    // 2. Periodic sync every 60 seconds
    const interval = setInterval(() => {
      triggerSync(true);
    }, 60000);

    // 3. Listen for global mutation events
    const handleMutationSync = () => {
      // Debounce slightly to allow local DB to settle
      setTimeout(() => triggerSync(true), 2000);
    };

    window.addEventListener('trigger-sync', handleMutationSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('trigger-sync', handleMutationSync);
    };
  }, [token, triggerSync]);

  return { triggerSync };
}
