/**
 * Structured Error Handling for the Recall Frontend.
 *
 * - Parses structured error responses from the backend
 * - Detects debug vs production mode
 * - Maps error codes to icons and severity levels
 */

// ── Types ───────────────────────────────────────────────────────────────

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface StructuredError {
  error_code: string;
  message: string;
  debug?: {
    detail: string;
    exception_type: string;
    traceback: string;
  };
}

export interface ApiError extends Error {
  errorCode: string;
  userMessage: string;
  debugDetail?: string;
  httpStatus?: number;
}

// ── Debug Mode Detection ────────────────────────────────────────────────

/**
 * Returns true if the app is running in development/debug mode.
 * Checks Vite's import.meta.env.DEV and Tauri's TAURI_DEBUG.
 */
export function isDebugMode(): boolean {
  try {
    // Vite sets this at build time
    if (import.meta.env.DEV) return true;
    // Tauri sets TAURI_DEBUG in dev builds
    if (import.meta.env.TAURI_DEBUG === '1' || import.meta.env.TAURI_DEBUG === 'true') return true;
  } catch {
    // Fallback
  }
  return false;
}

// ── Error Code Metadata ─────────────────────────────────────────────────

interface ErrorCodeMeta {
  icon: string;
  severity: ErrorSeverity;
  /** Whether the error is likely transient and retrying may help */
  retryable: boolean;
}

const ERROR_CODE_META: Record<string, ErrorCodeMeta> = {
  LLM_RATE_LIMITED:     { icon: '⏳', severity: 'warning', retryable: true },
  LLM_TIMEOUT:          { icon: '⏱️', severity: 'warning', retryable: true },
  LLM_CONNECTION_ERROR: { icon: '🔌', severity: 'error',   retryable: true },
  LLM_AUTH_FAILED:      { icon: '🔑', severity: 'error',   retryable: false },
  LLM_INVALID_RESPONSE: { icon: '⚠️', severity: 'warning', retryable: true },
  LLM_CONTENT_FILTERED: { icon: '🚫', severity: 'warning', retryable: false },
  LLM_QUOTA_EXCEEDED:   { icon: '💳', severity: 'error',   retryable: false },
  API_KEY_MISSING:      { icon: '🔑', severity: 'error',   retryable: false },
  OLLAMA_UNAVAILABLE:   { icon: '🖥️', severity: 'error',   retryable: true },
  PDF_CORRUPT:          { icon: '📄', severity: 'error',   retryable: false },
  PDF_EMPTY:            { icon: '📄', severity: 'warning', retryable: false },
  BOOK_NOT_FOUND:       { icon: '📚', severity: 'error',   retryable: false },
  TOPIC_NOT_FOUND:      { icon: '📝', severity: 'error',   retryable: false },
  FILE_NOT_FOUND:       { icon: '📁', severity: 'error',   retryable: false },
  INTERNAL_ERROR:       { icon: '❌', severity: 'error',   retryable: false },
};

export function getErrorMeta(code: string): ErrorCodeMeta {
  return ERROR_CODE_META[code] || { icon: '❌', severity: 'error', retryable: false };
}

// ── Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a structured error from an API response.
 * Falls back gracefully if the response doesn't have the expected shape.
 */
export async function parseApiError(res: Response): Promise<ApiError> {
  let structured: StructuredError | null = null;

  try {
    const body = await res.json();
    if (body.error_code && body.message) {
      structured = body as StructuredError;
    } else if (body.error) {
      // Legacy fallback: old-style { error: "..." } responses
      structured = {
        error_code: 'INTERNAL_ERROR',
        message: body.error,
      };
    } else if (body.detail) {
      // FastAPI HTTPException fallback
      structured = {
        error_code: 'INTERNAL_ERROR',
        message: typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail),
      };
    }
  } catch {
    // Response body wasn't JSON
  }

  const error = new Error(structured?.message || `Request failed with status ${res.status}`) as ApiError;
  error.errorCode = structured?.error_code || 'INTERNAL_ERROR';
  error.userMessage = structured?.message || 'Something went wrong. Please try again.';
  error.httpStatus = res.status;

  if (structured?.debug) {
    error.debugDetail = structured.debug.detail;
  }

  return error;
}

/**
 * Parse a structured error from an SSE error event.
 */
export function parseSSEError(data: Record<string, any>): ApiError {
  const error = new Error(data.message || data.error || 'Stream error') as ApiError;
  error.errorCode = data.error_code || 'INTERNAL_ERROR';
  error.userMessage = data.message || data.error || 'Something went wrong.';

  if (data.debug) {
    error.debugDetail = data.debug.detail;
  }

  return error;
}

/**
 * Get the appropriate message to display based on debug mode.
 */
export function getDisplayMessage(error: ApiError): string {
  if (isDebugMode() && error.debugDetail) {
    return `${error.userMessage}\n\nDebug: ${error.debugDetail}`;
  }
  return error.userMessage;
}
