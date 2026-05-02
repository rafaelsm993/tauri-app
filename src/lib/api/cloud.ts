/**
 * Cloud API HTTP client.
 *
 * Set VITE_CLOUD_API_URL in .env (or at build time) to enable cloud mode.
 * Example: VITE_CLOUD_API_URL=https://tauri-app-server.fly.dev
 */

export const CLOUD_API_URL: string = import.meta.env.VITE_CLOUD_API_URL ?? '';

const ACCESS_KEY = 'tf_cloud_token';
const REFRESH_KEY = 'tf_cloud_refresh';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function saveTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function extractError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.error ?? json.message ?? text;
  } catch {
    return text;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${CLOUD_API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      const refreshRes = await fetch(`${CLOUD_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json() as { access_token: string; refresh_token: string };
        saveTokens(data.access_token, data.refresh_token);
        headers['Authorization'] = `Bearer ${data.access_token}`;
        res = await fetch(`${CLOUD_API_URL}${path}`, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } else {
        clearTokens();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
    } else {
      throw new Error('Não autenticado.');
    }
  }

  if (!res.ok) throw new Error(await extractError(res));
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types mirroring server DTOs ───────────────────────────────────────────────

export interface CloudUser {
  id: string;
  name: string;
  email: string;
}

export interface CloudAuthResponse {
  user: CloudUser;
  access_token: string;
  refresh_token: string;
}

export interface CloudWatchlistItem {
  id: string;
  user_id: string;
  media_type: string;
  title: string;
  poster: string | null;
  status: string;
  added_at: string;
  updated_at: string;
}

export interface CloudWatchlistAddRequest {
  id: string;
  media_type: string;
  title: string;
  poster: string | null;
  status: string;
  added_at: string;
}

// ── API surface ───────────────────────────────────────────────────────────────

export const CloudAPI = {
  /** Returns true when a cloud server URL is configured. */
  isConfigured: () => Boolean(CLOUD_API_URL),

  auth: {
    register: (name: string, email: string, password: string) =>
      request<CloudAuthResponse>('POST', '/auth/register', { name, email, password }),

    login: (email: string, password: string) =>
      request<CloudAuthResponse>('POST', '/auth/login', { email, password }),

    me: () => request<CloudUser>('GET', '/auth/me'),

    listUsers: () => request<CloudUser[]>('GET', '/auth/users'),

    refresh: (refresh_token: string) =>
      request<{ access_token: string; refresh_token: string }>('POST', '/auth/refresh', {
        refresh_token,
      }),
  },

  watchlist: {
    getAll: () => request<CloudWatchlistItem[]>('GET', '/watchlist'),

    add: (item: CloudWatchlistAddRequest) =>
      request<void>('POST', '/watchlist/items', item),

    remove: (id: string) => request<void>('DELETE', `/watchlist/items/${encodeURIComponent(id)}`),

    updateStatus: (id: string, status: string) =>
      request<void>('PUT', `/watchlist/items/${encodeURIComponent(id)}/status`, { status }),

    sync: (items: CloudWatchlistAddRequest[]) =>
      request<CloudWatchlistItem[]>('POST', '/watchlist/sync', { items }),
  },
};
