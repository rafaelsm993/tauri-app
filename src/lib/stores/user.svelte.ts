import type { User } from '$lib/types/media';
import { AuthAPI } from '$lib/api/auth';

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
  error = $state('');
  loading = $state(false);

  async register(name: string, email: string, password: string) {
    this.loading = true;
    this.error = '';
    try {
      const user = await AuthAPI.register({ name, email, password });
      this.currentUser = user;
      persistUser(user);
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
      const user = await AuthAPI.login({ email, password });
      this.currentUser = user;
      persistUser(user);
    } catch (e: any) {
      this.error = typeof e === 'string' ? e : (e?.message ?? 'Erro ao entrar.');
      throw e;
    } finally {
      this.loading = false;
    }
  }

  logout() {
    this.currentUser = null;
    persistUser(null);
  }
}

export const userStore = new UserStore();
