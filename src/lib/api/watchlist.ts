import { invoke } from '@tauri-apps/api/core';
import type { MediaItem } from '$lib/types/media';

export type WatchlistStatus = 'want' | 'watching' | 'watched';

export interface WatchlistItem {
  id: string;
  user_id: number;
  media_type: string;
  title: string;
  poster: string | null;
  status: WatchlistStatus;
  added_at: string;
}

export const WatchlistAPI = {
  async add(item: MediaItem, status: WatchlistStatus, userId: number) {
    const wlItem = {
      id: String(item.id),
      user_id: userId,
      media_type: item.media_type,
      title: item.title,
      poster: item.poster_path ?? null,
      status,
      added_at: new Date().toISOString(),
    };
    await invoke('add_to_watchlist', { item: wlItem });
  },
  async remove(id: string | number, userId: number) {
    await invoke('remove_from_watchlist', { id: String(id), userId });
  },
  async updateStatus(id: string | number, status: WatchlistStatus, userId: number) {
    await invoke('update_watchlist_status', { id: String(id), userId, status });
  },
  async getAll(userId: number): Promise<WatchlistItem[]> {
    return await invoke('get_watchlist', { userId });
  },
  async getStatus(id: string | number, userId: number): Promise<WatchlistStatus | null> {
    return await invoke('get_watchlist_status', { id: String(id), userId });
  },
};
