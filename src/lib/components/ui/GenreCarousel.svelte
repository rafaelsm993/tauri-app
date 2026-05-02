<script lang="ts">
  // ============================================================
  // GenreCarousel — horizontally-scrolling row of MediaCards used
  // on the home page to surface one genre at a time. The internal
  // scroll container snaps to card boundaries; left/right arrow
  // buttons appear on hover and are hidden when there is nothing
  // to scroll in that direction.
  // ============================================================
  import type { MediaItem } from "$lib/types/media";
  import MediaCard from "$lib/components/media/MediaCard.svelte";

  let {
    title,
    items = [],
    loading = false,
    error = "",
    onCardClick,
    onSeeMore,
  } = $props<{
    title: string;
    items: MediaItem[];
    loading?: boolean;
    error?: string;
    onCardClick: (item: MediaItem) => void;
    onSeeMore?: () => void;
  }>();

  let railEl = $state<HTMLDivElement | undefined>(undefined);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  function refreshArrows() {
    if (!railEl) return;
    canScrollLeft = railEl.scrollLeft > 4;
    canScrollRight =
      railEl.scrollLeft + railEl.clientWidth < railEl.scrollWidth - 4;
  }

  function scrollByAmount(dir: -1 | 1) {
    if (!railEl) return;
    // Scroll by ~85% of the visible width so the user always sees a couple
    // of cards from the previous page for spatial continuity.
    const amount = Math.round(railEl.clientWidth * 0.85) * dir;
    railEl.scrollBy({ left: amount, behavior: "smooth" });
  }

  $effect(() => {
    if (railEl && !loading && items.length > 0) refreshArrows();
  });
</script>

<section class="carousel">
  <header class="carousel-head">
    <h2 class="carousel-title">{title}</h2>
    {#if onSeeMore && !loading && items.length > 0}
      <button type="button" class="see-more" onclick={onSeeMore}>
        Ver todos →
      </button>
    {/if}
  </header>

  <div class="carousel-body">
    {#if canScrollLeft && !loading}
      <button
        type="button"
        class="nav-btn nav-btn-left"
        aria-label="Anterior"
        onclick={() => scrollByAmount(-1)}
      >
        ‹
      </button>
    {/if}

    <div bind:this={railEl} class="rail" role="list" onscroll={refreshArrows}>
      {#if loading}
        {#each { length: 8 } as _}
          <div class="rail-item skeleton">
            <div class="skeleton-poster"></div>
            <div class="skeleton-line" style="width:68%"></div>
          </div>
        {/each}
      {:else if error}
        <p class="rail-error">⚠ {error}</p>
      {:else if items.length === 0}
        <p class="rail-empty">Nenhum item disponível.</p>
      {:else}
        {#each items as item, i (`${item.media_type}-${item.id}-${i}`)}
          <div class="rail-item" role="listitem">
            <MediaCard {item} onclick={() => onCardClick(item)} />
          </div>
        {/each}
      {/if}
    </div>

    {#if canScrollRight && !loading}
      <button
        type="button"
        class="nav-btn nav-btn-right"
        aria-label="Próximo"
        onclick={() => scrollByAmount(1)}
      >
        ›
      </button>
    {/if}
  </div>
</section>

<style lang="scss">
  .carousel {
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    margin-bottom: $spacing-xl;
    min-width: 0; // critical: lets the rail's overflow:auto kick in
  }

  .carousel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-md;
    padding: 0 $spacing-xs;
  }

  .carousel-title {
    font-family: $font-display;
    font-size: 1.25rem;
    letter-spacing: 0.04em;
    margin: 0;
    color: $color-text-main;
  }

  .see-more {
    background: none;
    border: none;
    color: $color-primary;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: $radius-sm;
    transition: color $dur-fast ease;
    &:hover {
      color: $color-text-main;
    }
  }

  // ── Body / rail ─────────────────────────────────────────
  .carousel-body {
    position: relative;
    min-width: 0;
  }

  .rail {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 160px;
    gap: $spacing-md;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    padding: $spacing-xs;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .rail-item {
    scroll-snap-align: start;
    width: 160px;
    min-width: 0;

    // MediaCard's .card is an unwidth'd <button>, so within a grid track
    // it can fall back to intrinsic sizing and posters end up at varied
    // widths. Force every card to fill the rail track for a uniform row.
    :global(.card) {
      width: 100%;
    }
  }

  .rail-empty,
  .rail-error {
    color: $color-text-faint;
    font-size: 0.82rem;
    padding: $spacing-xl 0;
    text-align: center;
    width: 100%;
  }

  // ── Skeletons ───────────────────────────────────────────
  .skeleton {
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
        rgba(255, 255, 255, 0.05) 50%,
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
  }

  // ── Nav arrows ──────────────────────────────────────────
  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    width: 36px;
    height: 56px;
    border: none;
    border-radius: $radius-sm;
    color: $color-text-main;
    background: rgba(8, 11, 16, 0.75);
    backdrop-filter: blur(6px);
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity $dur-fast ease,
      background $dur-fast ease;
  }

  .nav-btn-left {
    left: -10px;
  }
  .nav-btn-right {
    right: -10px;
  }

  .carousel-body:hover .nav-btn,
  .nav-btn:focus-visible {
    opacity: 1;
  }

  .nav-btn:hover {
    background: rgba(232, 184, 75, 0.85);
    color: $color-bg-primary;
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
