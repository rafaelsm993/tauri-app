import type { MediaItem } from '$lib/types/media';
import type { WatchlistStatus, WatchlistItem } from '$lib/api/watchlist';
import { WatchlistAPI } from '$lib/api/watchlist';
import { userStore } from '$lib/stores/user.svelte';

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
        this.items = await WatchlistAPI.getAll(this.getUserId());
    }

    async loadForUser(userId: number | string) {
        this.items = await WatchlistAPI.getAll(Number(userId));
    }

    async add(item: MediaItem, status: WatchlistStatus) {
        await WatchlistAPI.add(item, status, this.getUserId());
        await this.load();
    }

    async remove(id: string | number) {
        await WatchlistAPI.remove(id, this.getUserId());
        await this.load();
    }

    async updateStatus(id: string | number, status: WatchlistStatus) {
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