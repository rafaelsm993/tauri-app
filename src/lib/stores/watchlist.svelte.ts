import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, WatchlistItem, WatchlistStatus } from '$lib/types/media';

class WatchlistStore {
  items = $state<WatchlistItem[]>([]);
  private userId: string | null = null;

  async loadForUser(userId: string) {
    this.userId = userId;
    try {
      const data = await invoke<WatchlistItem[]>('load_watchlist', { userId });
      this.items = data ?? [];
    } catch (e) {
      console.error('Failed to load watchlist:', e);
      this.items = [];
    }
  }

  private async persist() {
    if (!this.userId) return;
    await invoke('save_watchlist', { userId: this.userId, items: this.items });
  }

  async add(item: MediaItem, status: WatchlistStatus = 'want') {
    if (!this.items.find(i => i.id === item.id)) {
      this.items = [...this.items, { ...item, status, addedAt: new Date().toISOString() }];
      await this.persist();
    }
  }

  async remove(id: number) {
    this.items = this.items.filter(i => i.id !== id);
    await this.persist();
  }

  async updateStatus(id: number, status: WatchlistStatus) {
    this.items = this.items.map(i => i.id === id ? { ...i, status } : i);
    await this.persist();
  }

  isInWatchlist(id: number): boolean {
    return this.items.some(i => i.id === id);
  }

  getStatus(id: number): WatchlistStatus | null {
    return this.items.find(i => i.id === id)?.status ?? null;
  }

  clear() {
    this.items = [];
    this.userId = null;
  }
}

export const watchlist = new WatchlistStore();
