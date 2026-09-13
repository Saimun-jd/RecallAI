import { API_BASE } from './client';
import { isTauriEnvironment } from './keychain';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  workspace: Workspace;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

const safeFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const fetchFn = isTauriEnvironment() ? tauriFetch : window.fetch.bind(window);
  try {
    return await fetchFn(url, options as any);
  } catch (err: any) {
    throw new Error('Unable to connect to the Recall AI authentication server. Please check your connection.');
  }
};

export const parseAuthError = (status: number, data: any): string => {
  if (data?.error?.message) {
    return data.error.message;
  }
  if (typeof data?.detail === 'string') {
    return data.detail;
  }
  if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
    return data.detail[0].msg;
  }

  switch (status) {
    case 400:
      return 'Invalid request details. Please check your inputs.';
    case 401:
      return 'Invalid email or password. Please try again.';
    case 403:
      return 'Access denied. Please check your account permissions.';
    case 409:
      return 'An account with this email address already exists.';
    case 422:
      return 'Please verify that your email address and password meet all requirements.';
    case 429:
      return 'Too many authentication attempts. Please wait a minute before trying again.';
    case 500:
    case 502:
    case 503:
      return 'The authentication service is temporarily unavailable. Please try again shortly.';
    default:
      return 'An unexpected authentication error occurred. Please try again.';
  }
};

export const authApi = {
  async signup(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await safeFetch(`${API_BASE}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(parseAuthError(res.status, data));
    }
    return data.data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await safeFetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(parseAuthError(res.status, data));
    }
    return data.data;
  },

  async logout(token?: string | null): Promise<void> {
    if (!token) return;
    try {
      await safeFetch(`${API_BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Best effort on logout
    }
  },

  async getMe(token: string): Promise<{ user: User; workspace: Workspace }> {
    const res = await safeFetch(`${API_BASE}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(parseAuthError(res.status, data));
    }
    return data.data;
  },

  async setBackendUser(userId: string | null, token: string | null = null): Promise<void> {
    try {
      await safeFetch(`${API_BASE}/api/set-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || null,
          token: token || null,
        }),
      });
    } catch (e) {
      console.error('Failed to notify backend of user switch:', e);
    }
  },
};
