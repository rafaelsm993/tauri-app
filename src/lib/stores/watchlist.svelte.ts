import type { MediaItem } from '$lib/types/media';
import type { WatchlistStatus, WatchlistItem } from '$lib/api/watchlist';
import { WatchlistAPI } from '$lib/api/watchlist';
import { userStore } from '$lib/stores/user.svelte';
import { CloudAPI } from '$lib/api/cloud';

function cloudItemToWatchlistItem(item: {
  id: string; user_id: string; media_type: string; title: string;
  poster: string | null; status: string; added_at: string;
}): WatchlistItem {
  return {
    id: item.id,
    user_id: 0, // placeholder; not used in cloud mode
    media_type: item.media_type,
    title: item.title,
    poster: item.poster,
    status: item.status as WatchlistStatus,
    added_at: item.added_at,
  };
}

class WatchlistStore {
    items = $state<WatchlistItem[]>([]);

    private getUserId(): number {
        const user = userStore.currentUser;
        if (!user) throw new Error('Usuário não autenticado.');
        return Number(user.id);
    }

    async load() {
        if (!userStore.isLoggedIn) {
            this.items = [];
            return;
        }
        if (userStore.isCloudUser && CloudAPI.isConfigured()) {
            const raw = await CloudAPI.watchlist.getAll();
            this.items = raw.map(cloudItemToWatchlistItem);
            return;
        }
        this.items = await WatchlistAPI.getAll(this.getUserId());
    }

    async loadForUser(userId: number | string) {
        this.items = await WatchlistAPI.getAll(Number(userId));
    }

    async add(item: MediaItem, status: WatchlistStatus) {
        if (userStore.isCloudUser && CloudAPI.isConfigured()) {
            await CloudAPI.watchlist.add({
                id: String(item.id),
                media_type: item.media_type,
                title: item.title,
                poster: item.poster_path ?? null,
                status,
                added_at: new Date().toISOString(),
            });
            await this.load();
            return;
        }
        await WatchlistAPI.add(item, status, this.getUserId());
        await this.load();
    }

    async remove(id: string | number) {
        if (userStore.isCloudUser && CloudAPI.isConfigured()) {
            await CloudAPI.watchlist.remove(String(id));
            await this.load();
            return;
        }
        await WatchlistAPI.remove(id, this.getUserId());
        await this.load();
    }

    async updateStatus(id: string | number, status: WatchlistStatus) {
        if (userStore.isCloudUser && CloudAPI.isConfigured()) {
            await CloudAPI.watchlist.updateStatus(String(id), status);
            await this.load();
            return;
        }
        await WatchlistAPI.updateStatus(id, status, this.getUserId());
        await this.load();
    }

    isInWatchlist(id: string | number) {
        return this.items.some(i => i.id === String(id));
    }

    getStatus(id: string | number): WatchlistStatus | null {
        const found = this.items.find(i => i.id === String(id));
        return found ? found.status : null;
    }
}

export const watchlist = new WatchlistStore();
