import { invoke } from '@tauri-apps/api/core';
import type { User } from '$lib/types/media';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const AuthAPI = {
  async register(payload: RegisterPayload): Promise<User> {
    const raw = await invoke<{ id: number; name: string; email: string }>('auth_register', { payload });
    return { id: raw.id, name: raw.name, email: raw.email };
  },

  async login(payload: LoginPayload): Promise<User> {
    const raw = await invoke<{ id: number; name: string; email: string }>('auth_login', { payload });
    return { id: raw.id, name: raw.name, email: raw.email };
  },

  async getUser(userId: number): Promise<User | null> {
    const raw = await invoke<{ id: number; name: string; email: string } | null>('auth_get_user', { userId });
    if (!raw) return null;
    return { id: raw.id, name: raw.name, email: raw.email };
  },

  async listUsers(): Promise<User[]> {
    const raw = await invoke<{ id: number; name: string; email: string }[]>('auth_list_users');
    return raw.map(u => ({ id: u.id, name: u.name, email: u.email }));
  },
};
