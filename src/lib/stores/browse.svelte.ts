// State and actions for the home (discovery) screen. Moved out of
// src/routes/+page.svelte so it can be unit tested with a fake Catalog.
// One instance per page mount: leaving the page and coming back starts
// fresh, exactly as before.
import { catalog as defaultCatalog, type Catalog } from "$lib/api/catalog";
import { errorMessage } from "$lib/utils/errors";
import { GENRE_SUPPORTED } from "$lib/types/media";
import type { GenreId, GenreOption, MediaItem, MediaType } from "$lib/types/media";

// Max genre carousels on the home view at once. Capped to keep API volume
// in check (AniList: 90 req/min, iTunes: ~20 req/min).
export const MAX_CAROUSELS = 8;

export type GenreSection = {
  genre: GenreOption;
  items: MediaItem[];
  loading: boolean;
  error: string;
};

export class BrowseStore {
  activeCategory = $state<MediaType>("movie");
  query = $state("");
  isSearch = $state(false);
  error = $state("");

  // Flat-grid mode (search or a specific genre)
  items = $state<MediaItem[]>([]);
  page = $state(1);
  totalPages = $state(1);
  loading = $state(false);
  appending = $state(false);

  // Carousel mode (default landing view): one section per top-N genre
  sections = $state<GenreSection[]>([]);

  // Genre filter
  genres = $state<GenreOption[]>([]);
  activeGenre = $state<GenreId | null>(null);
  genresLoading = $state(false);

  carouselMode = $derived(!this.isSearch && this.activeGenre === null);
  hasMore = $derived(this.page < this.totalPages && !this.error);

  #catalog: Catalog;
  // Per-category cache so switching tabs back and forth is instant.
  // Not reactive on purpose: only `genres` is rendered.
  #genreCache: Partial<Record<MediaType, GenreOption[]>> = {};

  constructor(catalog: Catalog = defaultCatalog) {
    this.#catalog = catalog;
  }

  async refreshGenres(cat: MediaType): Promise<GenreOption[]> {
    if (!GENRE_SUPPORTED.has(cat)) {
      this.genres = [];
      return [];
    }
    const cached = this.#genreCache[cat];
    if (cached) {
      this.genres = cached;
      return cached;
    }
    this.genresLoading = true;
    try {
      const list = await this.#catalog.fetchGenres(cat);
      this.#genreCache[cat] = list;
      this.genres = list;
      return list;
    } catch {
      this.genres = [];
      return [];
    } finally {
      this.genresLoading = false;
    }
  }

  // Requests run in parallel so one 429 doesn't block the rest. Writes from
  // a stale category (user switched tabs while waiting) are dropped.
  async loadCarousels(cat: MediaType, list: GenreOption[]) {
    const top = list.slice(0, MAX_CAROUSELS);
    this.sections = top.map((genre) => ({ genre, items: [], loading: true, error: "" }));
    if (top.length === 0) return;

    await Promise.allSettled(
      top.map(async (g, idx) => {
        try {
          const res = await this.#catalog.fetchPage(cat, "", 1, g.id);
          if (this.activeCategory !== cat) return;
          this.sections[idx] = { ...this.sections[idx], items: res.results, loading: false };
        } catch (e) {
          if (this.activeCategory !== cat) return;
          this.sections[idx] = {
            ...this.sections[idx],
            loading: false,
            error: errorMessage(e, "Erro."),
          };
        }
      }),
    );
  }

  async loadGrid(newQuery = this.query) {
    if (this.loading) return;
    this.query = newQuery;
    this.isSearch = !!newQuery.trim();
    this.page = 1;
    this.items = [];
    this.error = "";
    this.loading = true;
    try {
      const res = await this.#catalog.fetchPage(this.activeCategory, newQuery, 1, this.activeGenre);
      this.items = res.results;
      this.totalPages = res.total_pages ?? 1;
    } catch (e) {
      this.error = errorMessage(e, "Erro ao buscar dados.");
    } finally {
      this.loading = false;
    }
  }

  async loadMore() {
    if (this.appending || !this.hasMore || this.carouselMode) return;
    this.appending = true;
    try {
      const next = this.page + 1;
      const res = await this.#catalog.fetchPage(
        this.activeCategory,
        this.query,
        next,
        this.activeGenre,
      );
      this.items = [...this.items, ...res.results];
      this.page = next;
    } catch (e) {
      this.error = errorMessage(e, "Erro ao carregar mais.");
    } finally {
      this.appending = false;
    }
  }

  async refreshView() {
    this.error = "";
    if (this.carouselMode) {
      // Carousels need the genre list first; categories without genres
      // fall back to a single grid.
      const list = await this.refreshGenres(this.activeCategory);
      if (!GENRE_SUPPORTED.has(this.activeCategory) || list.length === 0) {
        await this.loadGrid("");
        return;
      }
      this.sections = [];
      this.items = [];
      this.loading = false;
      await this.loadCarousels(this.activeCategory, list);
    } else {
      this.sections = [];
      await this.loadGrid(this.query);
    }
  }

  search(q: string) {
    this.query = q;
    this.isSearch = !!q.trim();
    if (this.isSearch) {
      this.activeGenre = null; // search always renders as a flat grid
      return this.loadGrid(q);
    }
    return this.refreshView();
  }

  clearSearch() {
    this.query = "";
    this.isSearch = false;
    return this.refreshView();
  }

  async switchCategory(cat: MediaType) {
    if (cat === this.activeCategory && !this.loading) return;
    this.activeCategory = cat;
    this.activeGenre = null; // genre ids are not portable across providers
    await this.refreshGenres(cat);
    await this.refreshView();
  }

  async switchGenre(id: GenreId | null) {
    if (id === this.activeGenre) return;
    this.activeGenre = id;
    await this.refreshView();
  }
}
