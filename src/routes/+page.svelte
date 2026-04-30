<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { TmdbAPI } from "$lib/api/tmdb";
  import { AnilistAPI } from "$lib/api/anilist";
  import { ITunesAPI } from "$lib/api/itunes";
  import { RawgAPI } from "$lib/api/rawg";
  import type {
    MediaItem,
    MediaType,
    PaginatedResult,
    GenreOption,
    GenreId,
  } from "$lib/types/media";
  import { GENRE_SUPPORTED } from "$lib/types/media";
  import MediaCard from "$lib/components/media/MediaCard.svelte";
  import SearchBar from "$lib/components/ui/SearchBar.svelte";
  import CategoryTabs from "$lib/components/ui/CategoryTabs.svelte";
  import GenreFilter from "$lib/components/ui/GenreFilter.svelte";
  import GenreCarousel from "$lib/components/ui/GenreCarousel.svelte";

  // Maximum number of genre carousels rendered on the home view at once.
  // Capped to keep API request volume in check (AniList: 90 req/min,
  // iTunes: ~20 req/min documented). Users can drill into more genres
  // through the chip filter row above.
  const MAX_CAROUSELS = 8;

  let activeCategory = $state<MediaType>("movie");
  let query = $state("");
  let isSearch = $state(false);
  let error = $state("");

  // ── Flat-grid mode (search OR specific genre selected) ────
  let items = $state<MediaItem[]>([]);
  let page = $state(1);
  let totalPages = $state(1);
  let loading = $state(false);
  let appending = $state(false);

  // ── Carousel mode (default landing view) ──────────────────
  // One section per top-N genre for the active category. Each section
  // loads a single page of results in parallel.
  type GenreSection = {
    genre: GenreOption;
    items: MediaItem[];
    loading: boolean;
    error: string;
  };
  let sections = $state<GenreSection[]>([]);

  // ── Genre filter state ────────────────────────────────────
  // Cached per category so switching tabs back-and-forth is instant.
  let genreCache = $state<Partial<Record<MediaType, GenreOption[]>>>({});
  let genres = $state<GenreOption[]>([]);
  let activeGenre = $state<GenreId | null>(null);
  let genresLoading = $state(false);

  // True when the user is browsing carousels rather than a flat grid.
  const carouselMode = $derived(!isSearch && activeGenre === null);
  const hasMore = $derived(page < totalPages && !error);

  let sentinel = $state<HTMLDivElement | undefined>(undefined);
  let observer: IntersectionObserver;

  // Each provider exposes genres differently — centralised here.
  async function loadGenresFor(cat: MediaType): Promise<GenreOption[]> {
    switch (cat) {
      case "movie":
        return TmdbAPI.movieGenres();
      case "tv":
        return TmdbAPI.tvGenres();
      case "anime":
        return AnilistAPI.animeGenres();
      case "manga":
        return AnilistAPI.mangaGenres();
      case "book":
        return ITunesAPI.genres();
      case "game":
        return RawgAPI.genres();
      default:
        return [];
    }
  }

  async function refreshGenres(cat: MediaType): Promise<GenreOption[]> {
    if (!GENRE_SUPPORTED.has(cat)) {
      genres = [];
      return [];
    }
    if (genreCache[cat]) {
      genres = genreCache[cat]!;
      return genres;
    }
    genresLoading = true;
    try {
      const list = await loadGenresFor(cat);
      genreCache[cat] = list;
      genres = list;
      return list;
    } catch {
      genres = [];
      return [];
    } finally {
      genresLoading = false;
    }
  }

  async function fetchPage(
    cat: MediaType,
    q: string,
    p: number,
    g: GenreId | null,
  ): Promise<PaginatedResult<MediaItem>> {
    switch (cat) {
      case "movie": {
        const gid = typeof g === "number" ? g : undefined;
        return q.trim()
          ? TmdbAPI.searchMovies(q, p)
          : TmdbAPI.discoverMovies(p, gid);
      }
      case "tv": {
        const gid = typeof g === "number" ? g : undefined;
        return q.trim() ? TmdbAPI.searchTv(q, p) : TmdbAPI.discoverTv(p, gid);
      }
      case "anime": {
        const slug = typeof g === "string" ? g : undefined;
        return AnilistAPI.searchAnime(q.trim() || "", p, slug);
      }
      case "manga": {
        const slug = typeof g === "string" ? g : undefined;
        return AnilistAPI.searchManga(q.trim() || "", p, slug);
      }
      case "book": {
        const slug = typeof g === "string" ? g : undefined;
        return ITunesAPI.searchBooks(q.trim() || "popular", p, slug);
      }
      case "game": {
        const slug = typeof g === "string" ? g : undefined;
        return q.trim()
          ? RawgAPI.searchGames(q, p, slug)
          : RawgAPI.discoverGames(p, slug);
      }
      default:
        return { results: [], page: 1, total_pages: 1, total_results: 0 };
    }
  }

  // ── Carousel loading ──────────────────────────────────────
  // Initialises one section per top-N genre and fires the requests in
  // parallel via Promise.allSettled so a single 429 / 5xx doesn't block
  // the rest of the page.
  async function loadCarousels(cat: MediaType, list: GenreOption[]) {
    const top = list.slice(0, MAX_CAROUSELS);
    sections = top.map((g) => ({
      genre: g,
      items: [],
      loading: true,
      error: "",
    }));
    if (top.length === 0) return;

    const reqCat = cat;
    await Promise.allSettled(
      top.map(async (g, idx) => {
        try {
          const res = await fetchPage(reqCat, "", 1, g.id);
          // Skip writes from a stale category (user tab-jumped while we waited)
          if (activeCategory !== reqCat) return;
          sections[idx] = {
            ...sections[idx],
            items: res.results,
            loading: false,
          };
        } catch (e: any) {
          if (activeCategory !== reqCat) return;
          sections[idx] = {
            ...sections[idx],
            loading: false,
            error: typeof e === "string" ? e : (e?.message ?? "Erro."),
          };
        }
      }),
    );
  }

  // ── Flat-grid loading ─────────────────────────────────────
  async function loadGrid(newQuery = query) {
    if (loading) return;
    query = newQuery;
    isSearch = !!newQuery.trim();
    page = 1;
    items = [];
    error = "";
    loading = true;
    try {
      const res = await fetchPage(activeCategory, newQuery, 1, activeGenre);
      items = res.results;
      totalPages = res.total_pages ?? 1;
    } catch (e: any) {
      error =
        typeof e === "string" ? e : (e?.message ?? "Erro ao buscar dados.");
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (appending || !hasMore || carouselMode) return;
    appending = true;
    try {
      const next = page + 1;
      const res = await fetchPage(activeCategory, query, next, activeGenre);
      items = [...items, ...res.results];
      page = next;
    } catch (e: any) {
      error =
        typeof e === "string" ? e : (e?.message ?? "Erro ao carregar mais.");
    } finally {
      appending = false;
    }
  }

  // ── Top-level entry points ────────────────────────────────
  async function refreshView() {
    error = "";
    if (carouselMode) {
      // Carousels need the genre list resolved first; otherwise nothing
      // to enumerate. Fall back to a single grid when the category has
      // no genre support.
      const list = await refreshGenres(activeCategory);
      if (!GENRE_SUPPORTED.has(activeCategory) || list.length === 0) {
        await loadGrid("");
        return;
      }
      sections = [];
      items = [];
      loading = false;
      await loadCarousels(activeCategory, list);
    } else {
      sections = [];
      await loadGrid(query);
    }
  }

  function onSearch(q: string) {
    query = q;
    isSearch = !!q.trim();
    if (isSearch) {
      // Search always renders as a flat grid.
      activeGenre = null;
      loadGrid(q);
    } else {
      refreshView();
    }
  }

  function clearSearch() {
    query = "";
    isSearch = false;
    refreshView();
  }

  function switchCategory(cat: MediaType) {
    if (cat === activeCategory && !loading) return;
    activeCategory = cat;
    activeGenre = null; // genre ids are not portable across providers
    refreshGenres(cat).then(() => refreshView());
  }

  function switchGenre(id: GenreId | null) {
    if (id === activeGenre) return;
    activeGenre = id;
    refreshView();
  }

  function handleCardClick(item: MediaItem) {
    const type = item.media_type;
    const id = item.id;
    goto(`/media/${type}/${encodeURIComponent(String(id))}`);
  }

  function attachObserver() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    if (sentinel) observer.observe(sentinel);
  }

  $effect(() => {
    if (!carouselMode && !loading && items.length > 0 && sentinel) {
      attachObserver();
    }
  });

  onMount(() => {
    refreshView();
  });
  onDestroy(() => observer?.disconnect());
</script>

{#snippet SkeletonCard()}
  <div class="skeleton-card">
    <div class="skeleton-poster"></div>
    <div class="skeleton-line" style="width:68%"></div>
  </div>
{/snippet}

<div class="page">
  <header class="page-header">
    <SearchBar
      {onSearch}
      placeholder="Buscar filmes, séries, anime, mangá, livros…"
    />

    <CategoryTabs active={activeCategory} onchange={switchCategory} />
  </header>

  <div class="page-body">
    <!--
      Sticky left sidebar — holds the genre dropdown so it stays in
      reach while the user scrolls through carousels / grid results.
    -->
    <aside class="sidebar" aria-label="Filtros">
      {#if !isSearch}
        <div class="sidebar-section">
          <h3 class="sidebar-heading">Gêneros</h3>
          <GenreFilter
            {genres}
            active={activeGenre}
            loading={genresLoading}
            onchange={switchGenre}
          />
        </div>
      {/if}
    </aside>

    <main class="main-col">
      <p class="page-context">
        {#if isSearch}
          Resultados para <strong>"{query}"</strong>
          <button class="link-btn" onclick={clearSearch}>← Descobrir</button>
        {:else if activeGenre !== null}
          {@const current = genres.find((g) => g.id === activeGenre)?.name}
          Populares em <strong>{current ?? "gênero"}</strong>
          <button class="link-btn" onclick={() => switchGenre(null)}>
            ← Todos os gêneros
          </button>
        {:else}
          Explorar por gênero
        {/if}
      </p>

      {#if error && !carouselMode}
        <div class="page-error">
          <span>⚠ {error}</span>
          <button onclick={() => loadGrid(query)}>Tentar novamente</button>
        </div>
      {/if}

      {#if carouselMode}
        {#if sections.length === 0 && !genresLoading}
          <p class="page-empty">Nenhum gênero disponível.</p>
        {:else}
          {#each sections as section (section.genre.id)}
            <GenreCarousel
              title={section.genre.name}
              items={section.items}
              loading={section.loading}
              error={section.error}
              onCardClick={handleCardClick}
              onSeeMore={() => switchGenre(section.genre.id)}
            />
          {/each}
        {/if}
      {:else if loading}
        <div class="grid">
          {#each { length: 20 } as _}
            {@render SkeletonCard()}
          {/each}
        </div>
      {:else if !error && items.length === 0}
        <p class="page-empty">Nenhum resultado encontrado.</p>
      {:else}
        <div class="grid">
          {#each items as item, i (`${item.media_type}-${item.id}-${i}`)}
            <MediaCard {item} onclick={() => handleCardClick(item)} />
          {/each}
          {#if appending}
            {#each { length: 8 } as _}
              {@render SkeletonCard()}
            {/each}
          {/if}
        </div>

        {#if hasMore}
          <div bind:this={sentinel} class="sentinel" aria-hidden="true"></div>
        {:else if items.length > 0 && !appending}
          <p class="page-end">— Fim dos resultados —</p>
        {/if}
      {/if}
    </main>
  </div>
</div>

<style lang="scss">
  .page {
    padding: $spacing-lg $spacing-xl $spacing-2xl;
    max-width: 1440px;
    margin-inline: auto;
    overflow-x: clip; // contain any wide carousel rail
  }

  // ── Header ──────────────────────────────────────────────
  .page-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-sm;
    padding-bottom: $spacing-lg;
  }

  // ── Two-column body: sidebar list + main column ────────
  .page-body {
    display: flex;
    align-items: flex-start;
    gap: $spacing-xl;

    @media (max-width: 900px) {
      flex-direction: column;
    }
  }

  .sidebar {
    flex: 0 0 auto;
    width: max-content;
    max-width: 240px;
    position: sticky;
    top: $spacing-lg;
    align-self: flex-start;
    // shrink-to-content height — never stretches to the row's height
    height: max-content;
    max-height: calc(100vh - #{$spacing-2xl});
    display: flex;
    flex-direction: column;
    padding: $spacing-md $spacing-sm;
    background: rgba(10, 10, 10, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: $radius-lg;
    backdrop-filter: blur(14px) saturate(1.2);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    overflow-y: auto;
    overflow-x: hidden;
    // reserve gutter so scrollbar appearing/disappearing never shifts items
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.12);
      border-radius: $radius-full;
    }

    @media (max-width: 900px) {
      flex: 1 1 auto;
      width: 100%;
      position: static;
      max-height: none;
      overflow: visible;
    }
  }

  .sidebar-section {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-xs;
  }

  .sidebar-heading {
    margin: 0 0 $spacing-xs $spacing-sm;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: $color-text-faint;
  }

  .main-col {
    flex: 1 1 0;
    min-width: 0; // critical: lets carousel rails overflow:auto kick in
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  .page-context {
    font-size: 0.78rem;
    color: $color-text-faint;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    strong {
      color: $color-text-muted;
      font-weight: 600;
      text-transform: none;
    }
  }

  .link-btn {
    background: none;
    border: none;
    color: $color-primary;
    font-size: 0.78rem;
    cursor: pointer;
    margin-left: $spacing-sm;
    padding: 0;
    text-decoration: underline;
    &:hover {
      color: $color-text-main;
    }
  }

  // ── Grid ────────────────────────────────────────────────
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: $spacing-lg $spacing-md;
  }

  // ── Skeletons ───────────────────────────────────────────
  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .skeleton-poster {
    aspect-ratio: 2 / 3;
    border-radius: $radius-md;
    background: $color-bg-secondary;
    overflow: hidden;
    position: relative;
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 0%,
        rgba(255, 255, 255, 0.05) 45%,
        rgba(255, 255, 255, 0.09) 50%,
        rgba(255, 255, 255, 0.05) 55%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.7s ease-in-out infinite;
    }
  }

  .skeleton-line {
    height: 9px;
    border-radius: $radius-sm;
    background: $color-bg-secondary;
    position: relative;
    overflow: hidden;
    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 0%,
        rgba(255, 255, 255, 0.05) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.7s ease-in-out infinite 0.15s;
    }
  }

  // ── States ──────────────────────────────────────────────
  .page-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    padding: $spacing-md $spacing-lg;
    background: rgba(255, 82, 99, 0.07);
    border: 1px solid rgba(255, 82, 99, 0.2);
    border-radius: $radius-md;
    color: #ff5263;
    font-size: 0.84rem;
    margin-bottom: $spacing-md;
    button {
      background: none;
      border: 1px solid rgba(255, 82, 99, 0.3);
      color: #ff5263;
      padding: $spacing-xs $spacing-sm;
      border-radius: $radius-sm;
      font-size: 0.76rem;
      cursor: pointer;
      &:hover {
        background: rgba(255, 82, 99, 0.1);
      }
    }
  }

  .page-empty,
  .page-end {
    text-align: center;
    color: $color-text-faint;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    padding: $spacing-2xl 0;
  }

  .sentinel {
    height: 1px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
