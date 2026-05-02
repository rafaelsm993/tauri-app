import type { User } from '$lib/types/media';
import { AuthAPI } from '$lib/api/auth';
import { CloudAPI, saveTokens, clearTokens, getAccessToken } from '$lib/api/cloud';

const STORAGE_KEY = 'tauriflix_user';

function loadPersistedUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function persistUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

class UserStore {
  currentUser = $state<User | null>(loadPersistedUser());
  isLoggedIn = $derived(this.currentUser !== null);
  /** True when the session is backed by the cloud server JWT. */
  isCloudUser = $state(Boolean(getAccessToken()));
  error = $state('');
  loading = $state(false);

  async register(name: string, email: string, password: string) {
    this.loading = true;
    this.error = '';
    try {
      if (CloudAPI.isConfigured()) {
        const { user, access_token, refresh_token } = await CloudAPI.auth.register(name, email, password);
        saveTokens(access_token, refresh_token);
        this.currentUser = { id: user.id, name: user.name, email: user.email };
        this.isCloudUser = true;
      } else {
        const user = await AuthAPI.register({ name, email, password });
        this.currentUser = user;
        this.isCloudUser = false;
      }
      persistUser(this.currentUser);
    } catch (e: any) {
      this.error = typeof e === 'string' ? e : (e?.message ?? 'Erro ao registrar.');
      throw e;
    } finally {
      this.loading = false;
    }
  }

  async login(email: string, password: string) {
    this.loading = true;
    this.error = '';
    try {
      if (CloudAPI.isConfigured()) {
        const { user, access_token, refresh_token } = await CloudAPI.auth.login(email, password);
        saveTokens(access_token, refresh_token);
        this.currentUser = { id: user.id, name: user.name, email: user.email };
        this.isCloudUser = true;
      } else {
        const user = await AuthAPI.login({ email, password });
        this.currentUser = user;
        this.isCloudUser = false;
      }
      persistUser(this.currentUser);
    } catch (e: any) {
      this.error = typeof e === 'string' ? e : (e?.message ?? 'Erro ao entrar.');
      throw e;
    } finally {
      this.loading = false;
    }
  }

  logout() {
    if (this.isCloudUser) clearTokens();
    this.currentUser = null;
    this.isCloudUser = false;
    persistUser(null);
  }

  /** Returns the list of registered users — cloud-aware. */
  async listUsers(): Promise<User[]> {
    if (CloudAPI.isConfigured()) {
      const users = await CloudAPI.auth.listUsers();
      return users.map(u => ({ id: u.id, name: u.name, email: u.email }));
    }
    return AuthAPI.listUsers();
  }
}

export const userStore = new UserStore();
