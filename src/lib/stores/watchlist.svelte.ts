import type { MediaItem } from '$lib/types/media';

// Estado global usando Svelte 5 Runes
class WatchlistStore {
    items = $state<MediaItem[]>([]);

    add(movie: MediaItem) {
        if (!this.items.find(i => i.id === movie.id)) {
            this.items.push(movie);
        }
    }

    remove(id: number) {
        this.items = this.items.filter(i => i.id !== id);
    }
}

// Exporta uma única instância para toda a aplicação usar
export const watchlist = new WatchlistStore();