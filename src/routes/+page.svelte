<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TmdbAPI } from '$lib/api/tmdb';
  import type { MediaItem, PaginatedResult } from '$lib/types/media';
  import MediaCard from '$lib/components/media/MediaCard.svelte';
  import SearchBar from '$lib/components/ui/SearchBar.svelte';

  let items      = $state<MediaItem[]>([]);
  let query      = $state('');
  let page       = $state(1);
  let totalPages = $state(1);
  let isSearch   = $state(false);
  let loading    = $state(false);
  let appending  = $state(false);
  let error      = $state('');

  const hasMore = $derived(page < totalPages && !error);

  let sentinel = $state<HTMLDivElement | undefined>(undefined);
  let observer: IntersectionObserver;

  async function fetchPage(q: string, p: number): Promise<PaginatedResult<MediaItem>> {
    return q.trim() ? TmdbAPI.searchMovies(q, p) : TmdbAPI.discoverMovies(p);
  }

  async function load(newQuery = '') {
    if (loading) return;
    query    = newQuery;
    isSearch = !!newQuery.trim();
    page     = 1;
    items    = [];
    error    = '';
    loading  = true;
    try {
      const res  = await fetchPage(newQuery, 1);
      items      = res.results;
      totalPages = res.total_pages ?? 1;
    } catch (e: any) {
      error = typeof e === 'string' ? e : (e?.message ?? 'Erro ao buscar dados.');
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (appending || !hasMore) return;
    appending = true;
    try {
      const next = page + 1;
      const res  = await fetchPage(query, next);
      items      = [...items, ...res.results];
      page       = next;
    } catch (e: any) {
      error = typeof e === 'string' ? e : (e?.message ?? 'Erro ao carregar mais.');
    } finally {
      appending = false;
    }
  }

  function attachObserver() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '300px' }
    );
    if (sentinel) observer.observe(sentinel);
  }

  $effect(() => {
    if (!loading && items.length > 0 && sentinel) attachObserver();
  });

  onMount(() => { load(); attachObserver(); });
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
    <SearchBar onSearch={(q) => load(q)} placeholder="Buscar filmes, séries, anime…" />
    {#if !loading}
      <p class="page-context">
        {#if isSearch}
          Resultados para <strong>"{query}"</strong>
          <button class="link-btn" onclick={() => load()}>← Descobrir</button>
        {:else}
          Populares agora
        {/if}
      </p>
    {/if}
  </header>

  {#if error}
    <div class="page-error">
      <span>⚠ {error}</span>
      <button onclick={() => load(query)}>Tentar novamente</button>
    </div>
  {/if}

  {#if loading}
    <div class="grid">
      {#each { length: 20 } as _}
        {@render SkeletonCard()}
      {/each}
    </div>

  {:else if !error && items.length === 0}
    <p class="page-empty">Nenhum resultado encontrado.</p>

  {:else}
    <div class="grid">
      {#each items as item (item.id)}
        <MediaCard {item} onclick={() => console.log('open', item.id)} />
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

</div>

<style lang="scss">
  .page {
    /* KEY FIX: z-index 5 puts page content above the vignette (z-index 3)
       and canvas/orbs (z-index 2) from AppBackground */
    position: relative;
    z-index: 5;
    padding: $spacing-lg $spacing-xl $spacing-2xl;
    max-width: 1440px;
    margin-inline: auto;
  }

  // ── Header ──────────────────────────────────────────────
  .page-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-sm;
    padding-bottom: $spacing-lg;
  }

  .page-context {
    font-size: 0.78rem;
    color: $color-text-faint;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    strong { color: $color-text-muted; font-weight: 600; text-transform: none; }
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
    &:hover { color: $color-text-main; }
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
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(
        100deg,
        transparent 0%,
        rgba(255,255,255,0.05) 45%,
        rgba(255,255,255,0.09) 50%,
        rgba(255,255,255,0.05) 55%,
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
    position: relative; overflow: hidden;
    &::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
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
      &:hover { background: rgba(255, 82, 99, 0.1); }
    }
  }

  .page-empty, .page-end {
    text-align: center;
    color: $color-text-faint;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    padding: $spacing-2xl 0;
  }

  .sentinel { height: 1px; }

  @keyframes shimmer {
    0%   { background-position:  200% 0; }
    100% { background-position: -200% 0; }
  }
</style>