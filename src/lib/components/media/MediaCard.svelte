<script lang="ts">
  import type { MediaItem } from '$lib/types/media';
  import { TMDB_IMG, getYear, getRating } from '$lib/types/media';

  let { item, onclick } = $props<{
    item: MediaItem;
    onclick?: () => void;
  }>();

  let loaded  = $state(false);
  let errored = $state(false);

  // $derived ensures these re-evaluate if item prop changes
  const poster = $derived(TMDB_IMG.poster(item.poster_path, 'w342'));
  const year   = $derived(getYear(item));
  const rating = $derived(getRating(item));
  const badge  = $derived(item.media_type === 'tv' ? 'Série' : 'Filme');
</script>

<button class="card" {onclick} type="button">

  <!-- Poster area -->
  <div class="card__poster">

    <!-- Shimmer skeleton while image loads -->
    {#if poster && !loaded && !errored}
      <div class="card__shimmer" aria-hidden="true"></div>
    {/if}

    <!-- Actual poster image -->
    {#if poster && !errored}
      <img
        src={poster}
        alt={item.title}
        loading="lazy"
        class="card__img"
        class:card__img--loaded={loaded}
        onload={() => (loaded = true)}
        onerror={() => (errored = true)}
      />
    {/if}

    <!-- No-poster fallback -->
    {#if !poster || errored}
      <div class="card__no-poster" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="m8 21 4-4 4 4"/><path d="M10 9l4 4"/>
        </svg>
        <span>{item.title}</span>
      </div>
    {/if}

    <!-- Overlay: revealed on hover -->
    <div class="card__overlay" aria-hidden="true">

      <div class="card__overlay-top">
        <span class="card__type">{badge}</span>
        {#if rating}
          <span class="card__score">★ {rating}</span>
        {/if}
      </div>

      <div class="card__overlay-body">
        <p class="card__overlay-title">{item.title}</p>
        {#if item.overview}
          <p class="card__overview">{item.overview}</p>
        {/if}
        <div class="card__meta">
          {#if year}<span>{year}</span>{/if}
          {#if item.vote_count > 0}
            <span>·</span>
            <span>{item.vote_count.toLocaleString('pt-BR')} avaliações</span>
          {/if}
        </div>
      </div>

    </div>

  </div>

  <!-- Static label below poster (always visible) -->
  <div class="card__label">
    <span class="card__label-title">{item.title}</span>
    {#if year}<span class="card__label-year">{year}</span>{/if}
  </div>

</button>

<style lang="scss">
  // ── Card shell ──────────────────────────────────────────
  .card {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    outline: none;

    &:focus-visible .card__poster {
      outline: 2px solid $color-primary;
      outline-offset: 3px;
    }
  }

  // ── Poster ──────────────────────────────────────────────
  .card__poster {
    position: relative;
    aspect-ratio: 2 / 3;
    border-radius: $radius-md;
    overflow: hidden;
    background: $color-bg-secondary;
    border: 1px solid rgba(255, 255, 255, 0.05);
    will-change: transform;
    transition:
      transform    350ms $ease-out-expo,
      box-shadow   350ms $ease-out-expo,
      border-color 220ms ease;

    .card:hover & {
      transform: translateY(-8px) scale(1.04);
      border-color: rgba(232, 184, 75, 0.4);
      box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.75),
        0 0   0 1px rgba(232, 184, 75, 0.18),
        0 0  40px rgba(232, 184, 75, 0.10);
    }

    .card:active & {
      transform: translateY(-3px) scale(1.01);
      transition-duration: 100ms;
    }
  }

  // ── Image ───────────────────────────────────────────────
  .card__img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity 400ms ease, filter 350ms ease;

    &--loaded { opacity: 1; }

    .card:hover & {
      filter: brightness(0.38) saturate(1.15);
    }
  }

  // ── Shimmer skeleton ────────────────────────────────────
  .card__shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      100deg,
      rgba(255, 255, 255, 0.00)  0%,
      rgba(255, 255, 255, 0.04) 40%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.04) 60%,
      rgba(255, 255, 255, 0.00) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  // ── No-poster fallback ──────────────────────────────────
  .card__no-poster {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    padding: $spacing-md;
    background: linear-gradient(160deg, $color-bg-secondary 0%, $color-bg-primary 100%);
    color: $color-text-faint;

    span {
      font-size: 0.7rem;
      text-align: center;
      line-height: 1.4;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }

    .card:hover & { filter: brightness(0.45); }
  }

  // ── Hover overlay ───────────────────────────────────────
  .card__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: $spacing-sm;
    opacity: 0;
    pointer-events: none;
    transition: opacity 300ms ease;
    // Gradient: transparent top → dark bottom
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.05)   0%,
      rgba(0, 0, 0, 0)      25%,
      rgba(0, 0, 0, 0)      40%,
      rgba(8, 11, 16, 0.94) 100%
    );

    .card:hover & { opacity: 1; }
  }

  .card__overlay-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  .card__overlay-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  // ── Type badge ──────────────────────────────────────────
  .card__type {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: $color-primary;
    color: $color-bg-primary;
    padding: 2px 6px;
    border-radius: $radius-sm;
    line-height: 1.7;
    white-space: nowrap;
  }

  // ── Score pill ──────────────────────────────────────────
  .card__score {
    font-family: $font-mono;
    font-size: 0.68rem;
    font-weight: 500;
    color: $color-primary;
    background: rgba(232, 184, 75, 0.12);
    border: 1px solid rgba(232, 184, 75, 0.28);
    padding: 2px 7px;
    border-radius: $radius-sm;
    line-height: 1.7;
    white-space: nowrap;
  }

  // ── Overlay text ────────────────────────────────────────
  .card__overlay-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: #fff;
    line-height: 1.3;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card__overview {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.58);
    line-height: 1.55;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;

    span {
      font-family: $font-mono;
      font-size: 0.58rem;
      color: rgba(255, 255, 255, 0.35);
      letter-spacing: 0.03em;
    }
  }

  // ── Static label below poster ───────────────────────────
  .card__label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-xs;
    padding: 0 $spacing-xs;
  }

  .card__label-title {
    font-size: 0.78rem;
    font-weight: 500;
    color: $color-text-muted;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    transition: color 200ms ease;

    .card:hover & { color: $color-text-main; }
  }

  .card__label-year {
    font-family: $font-mono;
    font-size: 0.64rem;
    color: $color-text-faint;
    flex-shrink: 0;
  }

  // ── Keyframes ───────────────────────────────────────────
  @keyframes shimmer {
    0%   { background-position:  200% 0; }
    100% { background-position: -200% 0; }
  }
</style>