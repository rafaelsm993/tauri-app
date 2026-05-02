<script lang="ts">
  import { goto } from "$app/navigation";
  import { watchlist } from "$lib/stores/watchlist.svelte";
  import MediaCard from "$lib/components/media/MediaCard.svelte";
  import type { WatchlistStatus } from "$lib/types/media";

  type FilterTab = "all" | WatchlistStatus;

  let activeTab = $state<FilterTab>("all");

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "want", label: "Quero Assistir" },
    { key: "watching", label: "Assistindo" },
    { key: "watched", label: "Assistido" },
  ];

  const statusColors: Record<WatchlistStatus, string> = {
    want: "#a78bfa",
    watching: "#60a5fa",
    watched: "#4ade80",
  };

  const statusLabels: Record<WatchlistStatus, string> = {
    want: "Quero Assistir",
    watching: "Assistindo",
    watched: "Assistido",
  };

  // Map WatchlistItem to MediaItem for MediaCard
  import type { WatchlistItem } from "$lib/api/watchlist";
  import type { MediaItem } from "$lib/types/media";

  function toMediaItem(item: WatchlistItem): MediaItem {
    return {
      id: item.id,
      media_type: item.media_type as import("$lib/types/media").MediaType,
      title: item.title,
      overview: "", // No overview in watchlist DB
      poster_path: item.poster ?? null,
      backdrop_path: null,
      vote_average: 0,
      vote_count: 0,
    };
  }

  const filtered = $derived(
    activeTab === "all"
      ? watchlist.items
      : watchlist.items.filter((i) => i.status === activeTab),
  );

  const counts: Record<FilterTab, number> = $derived({
    all: watchlist.items.length,
    want: watchlist.items.filter((i) => i.status === "want").length,
    watching: watchlist.items.filter((i) => i.status === "watching").length,
    watched: watchlist.items.filter((i) => i.status === "watched").length,
  });
</script>

<div class="watchlist-page">
  <div class="watchlist-header">
    <h1 class="watchlist-title">Minha Lista</h1>
    <p class="watchlist-count">
      {watchlist.items.length}
      {watchlist.items.length === 1 ? "item" : "itens"}
    </p>
  </div>

  <!-- Filter tabs -->
  <div class="filter-tabs" role="tablist">
    {#each tabs as t (t.key)}
      <button
        role="tab"
        class="filter-tab"
        class:active={activeTab === t.key}
        onclick={() => (activeTab = t.key)}
        aria-selected={activeTab === t.key}
      >
        {t.label}
        {#if counts[t.key] > 0}
          <span class="tab-count">{counts[t.key]}</span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Grid -->
  {#if filtered.length > 0}
    <div class="watchlist-grid">
      {#each filtered as item (item.id)}
        <div class="wl-card-wrap">
          <div
            class="status-badge"
            style="--status-color: {statusColors[item.status]}"
          >
            {statusLabels[item.status]}
          </div>
          <MediaCard
            item={toMediaItem(item)}
            onclick={() => goto(`/media/${item.media_type}/${item.id}`)}
          />
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      {#if watchlist.items.length === 0}
        <p class="empty-title">Sua lista está vazia</p>
        <p class="empty-sub">Explore filmes e séries e adicione à sua lista.</p>
        <button class="empty-cta" onclick={() => goto("/")}>Explorar</button>
      {:else}
        <p class="empty-title">
          Nenhum item em "{tabs.find((t) => t.key === activeTab)?.label}"
        </p>
        <p class="empty-sub">Mude o status de um item ou escolha outra aba.</p>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .watchlist-page {
    max-width: 1440px;
    margin-inline: auto;
    padding: $spacing-xl $spacing-xl $spacing-2xl;
    min-height: 100vh;

    @include respond-to(md) {
      padding: $spacing-md;
    }
  }

  // ── Header ──────────────────────────────────────────────
  .watchlist-header {
    display: flex;
    align-items: baseline;
    gap: $spacing-md;
    margin-bottom: $spacing-xl;
  }

  .watchlist-title {
    font-family: $font-display;
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    color: $color-text-main;
    letter-spacing: 0.03em;
    margin: 0;
  }

  .watchlist-count {
    color: $color-text-faint;
    font-size: 0.85rem;
    font-family: $font-mono;
    margin: 0;
  }

  // ── Filter tabs ─────────────────────────────────────────
  .filter-tabs {
    display: flex;
    gap: $spacing-xs;
    flex-wrap: wrap;
    margin-bottom: $spacing-xl;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: $spacing-md;
  }

  .filter-tab {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: $spacing-xs $spacing-md;
    border: 1px solid transparent;
    border-radius: $radius-full;
    background: transparent;
    color: $color-text-muted;
    font-family: $font-body;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      border-color $dur-fast,
      color $dur-fast,
      background $dur-fast;

    &:hover:not(.active) {
      border-color: rgba(255, 255, 255, 0.1);
      color: $color-text-main;
      background: rgba(255, 255, 255, 0.04);
    }

    &.active {
      border-color: rgba($color-primary, 0.4);
      background: rgba($color-primary, 0.1);
      color: $color-text-main;
    }
  }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: $radius-full;
    background: rgba(255, 255, 255, 0.1);
    font-size: 0.65rem;
    font-weight: 600;

    .filter-tab.active & {
      background: rgba($color-primary, 0.25);
    }
  }

  // ── Grid ────────────────────────────────────────────────
  .watchlist-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: $spacing-lg;

    @include respond-to(sm) {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: $spacing-md;
    }
  }

  // ── Card wrapper ────────────────────────────────────────
  .wl-card-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .status-badge {
    position: absolute;
    top: $spacing-sm;
    left: $spacing-sm;
    z-index: 5;
    padding: 2px $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.72);
    border: 1px solid var(--status-color);
    color: var(--status-color);
    pointer-events: none;
    backdrop-filter: blur(6px);
  }

  // ── Empty state ─────────────────────────────────────────
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    padding: $spacing-2xl;
    text-align: center;
    min-height: 360px;
  }

  .empty-title {
    font-size: 1.1rem;
    color: $color-text-muted;
    font-weight: 500;
    margin: 0;
  }

  .empty-sub {
    font-size: 0.85rem;
    color: $color-text-faint;
    margin: 0;
  }

  .empty-cta {
    margin-top: $spacing-md;
    padding: $spacing-sm $spacing-xl;
    border-radius: $radius-full;
    border: 1.5px solid rgba($color-primary, 0.4);
    background: rgba($color-primary, 0.1);
    color: $color-text-main;
    font-family: $font-body;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background $dur-fast,
      border-color $dur-fast;

    &:hover {
      background: rgba($color-primary, 0.2);
      border-color: $color-primary;
    }
  }
</style>
