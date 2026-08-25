/**
 * Lightweight Toast Notification System for Recall.
 *
 * Usage:
 *   1. Wrap your app with <ToastProvider>
 *   2. Use the useToast() hook in any component:
 *      const { showToast } = useToast();
 *      showToast('error', 'Something failed', 'Optional debug detail');
 */

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────────

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
  createdAt: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, detail?: string) => void;
}

// ── Context ─────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: log to console if ToastProvider is missing
    return {
      showToast: (type, message, detail) => {
        console.warn(`[Toast ${type}] ${message}`, detail || '');
      },
    };
  }
  return ctx;
}

// ── Config ──────────────────────────────────────────────────────────────

const MAX_TOASTS = 4;
const DEFAULT_DURATION_MS = 6000;
const ERROR_DURATION_MS = 12000;

function getDuration(type: ToastType): number {
  return type === 'error' ? ERROR_DURATION_MS : DEFAULT_DURATION_MS;
}

// ── Provider + Container ────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((type: ToastType, message: string, detail?: string) => {
    const id = `toast-${++toastIdRef.current}-${Date.now()}`;
    const toast: Toast = { id, type, message, detail, createdAt: Date.now() };

    setToasts(prev => {
      const next = [...prev, toast];
      // Evict oldest if over limit
      if (next.length > MAX_TOASTS) {
        const removed = next.shift()!;
        const timer = timersRef.current.get(removed.id);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(removed.id);
        }
      }
      return next;
    });

    // Auto-dismiss
    const timer = setTimeout(() => removeToast(id), getDuration(type));
    timersRef.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Toast Container ─────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '76px', // below the header
        right: '16px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '420px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Single Toast Item ───────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  error:   { bg: '#2d1214', border: '#7f1d1d', icon: '✕', iconColor: '#f87171' },
  warning: { bg: '#2d2514', border: '#78350f', icon: '⚠', iconColor: '#fbbf24' },
  success: { bg: '#142d1a', border: '#14532d', icon: '✓', iconColor: '#4ade80' },
  info:    { bg: '#14202d', border: '#1e3a5f', icon: 'ℹ', iconColor: '#60a5fa' },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const style = TOAST_STYLES[toast.type];

  const isDebug = (() => {
    try {
      return import.meta.env.DEV;
    } catch {
      return false;
    }
  })();

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '10px',
        padding: '12px 14px',
        pointerEvents: 'auto',
        animation: 'toast-slide-in 0.25s ease-out',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ color: style.iconColor, fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
          {style.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              color: '#e2e8f0',
              fontSize: '13px',
              lineHeight: '1.45',
              wordBreak: 'break-word',
            }}
          >
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            fontSize: '14px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Debug detail (only in dev mode) */}
      {isDebug && toast.detail && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '2px 0',
              textDecoration: 'underline',
            }}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </button>
          {expanded && (
            <pre
              style={{
                margin: '4px 0 0 0',
                padding: '8px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '11px',
                lineHeight: '1.4',
                maxHeight: '200px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {toast.detail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
