<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";
  import { TmdbAPI } from "$lib/api/tmdb";
  import { JikanAPI } from "$lib/api/jikan";
  import { OpenLibraryAPI } from "$lib/api/openlib";
  import type { MediaDetail } from "$lib/types/media";
  import { TMDB_IMG } from "$lib/types/media";
  import { ui } from "$lib/stores/ui.svelte";

  let detail = $state<MediaDetail | null>(null);
  let loading = $state(true);
  let error = $state("");

  // Toggle detail background mode
  ui.detailMode = true;
  onDestroy(() => {
    ui.detailMode = false;
  });

  // Drag-to-scroll for cast row
  let castEl = $state<HTMLDivElement | undefined>(undefined);
  let dragging = $state(false);
  let dragStartX = 0;
  let scrollStart = 0;

  function onDragStart(e: MouseEvent) {
    if (!castEl) return;
    dragging = true;
    dragStartX = e.clientX;
    scrollStart = castEl.scrollLeft;
  }

  function onDragMove(e: MouseEvent) {
    if (!dragging || !castEl) return;
    e.preventDefault();
    castEl.scrollLeft = scrollStart - (e.clientX - dragStartX);
  }

  function onDragEnd() {
    dragging = false;
  }

  const trailer = $derived(
    detail?.videos.find((v) => v.type === "Trailer") ??
      detail?.videos[0] ??
      null,
  );

  const year = $derived(detail?.release_date?.slice(0, 4) ?? "");
  const rating = $derived(
    detail && detail.vote_average > 0 ? detail.vote_average.toFixed(1) : "",
  );
  const runtimeStr = $derived(
    detail?.runtime
      ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`
      : "",
  );

  // For TMDB items, build URLs; for Jikan/OL the full URL is already in the field
  const isTmdb = $derived(detail?.media_type === 'movie' || detail?.media_type === 'tv');
  const posterUrl = $derived(
    detail?.poster_path
      ? (isTmdb ? TMDB_IMG.poster(detail.poster_path, "w500") : detail.poster_path)
      : null,
  );
  const backdropUrl = $derived(
    detail?.backdrop_path
      ? (isTmdb ? TMDB_IMG.backdrop(detail.backdrop_path, "w1280") : detail.backdrop_path)
      : null,
  );

  async function fetchDetail(type: string, id: string) {
    loading = true;
    error = "";
    detail = null;

    try {
      switch (type) {
        case 'movie': {
          const numId = parseInt(id, 10);
          if (isNaN(numId)) { error = "ID inválido."; break; }
          detail = await TmdbAPI.movieDetails(numId);
          break;
        }
        case 'tv': {
          const numId = parseInt(id, 10);
          if (isNaN(numId)) { error = "ID inválido."; break; }
          detail = await TmdbAPI.seriesDetails(numId);
          break;
        }
        case 'anime': {
          const numId = parseInt(id, 10);
          if (isNaN(numId)) { error = "ID inválido."; break; }
          detail = await JikanAPI.animeDetails(numId);
          break;
        }
        case 'manga': {
          const numId = parseInt(id, 10);
          if (isNaN(numId)) { error = "ID inválido."; break; }
          detail = await JikanAPI.mangaDetails(numId);
          break;
        }
        case 'book': {
          const key = decodeURIComponent(id);
          detail = await OpenLibraryAPI.bookDetails(key);
          break;
        }
        default:
          error = "Tipo de mídia inválido.";
      }
    } catch (e: any) {
      error =
        typeof e === "string"
          ? e
          : (e?.message ?? "Erro ao carregar detalhes.");
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const params = $page.params;
    fetchDetail(params.type ?? "", params.id ?? "");
  });
</script>

{#if loading}
  <div class="detail-skeleton">
    <div class="skeleton-hero"></div>
    <div class="skeleton-body">
      <div class="skeleton-poster-ph"></div>
      <div class="skeleton-info">
        <div class="skeleton-line" style="width:60%;height:28px"></div>
        <div
          class="skeleton-line"
          style="width:40%;height:14px;margin-top:12px"
        ></div>
        <div
          class="skeleton-line"
          style="width:90%;height:14px;margin-top:24px"
        ></div>
        <div
          class="skeleton-line"
          style="width:85%;height:14px;margin-top:8px"
        ></div>
        <div
          class="skeleton-line"
          style="width:70%;height:14px;margin-top:8px"
        ></div>
      </div>
    </div>
  </div>
{:else if error}
  <div class="detail-error">
    <span>⚠ {error}</span>
    <button
      onclick={() => {
        const p = $page.params;
        fetchDetail(p.type ?? "", p.id ?? "");
      }}>Tentar novamente</button
    >
    <button onclick={() => goto("/")}>← Voltar</button>
  </div>
{:else if detail}
  <!-- Hero backdrop -->
  <div class="hero">
    {#if backdropUrl}
      <img
        src={backdropUrl}
        alt=""
        class="hero-img"
      />
    {/if}
    <div class="hero-fade"></div>
    <div class="hero-content">
      <button class="back-btn" onclick={() => goto("/")}>← Voltar</button>
      <h1 class="hero-title">{detail.title}</h1>
      {#if detail.tagline}
        <p class="hero-tagline">{detail.tagline}</p>
      {/if}
    </div>
  </div>

  <!-- Main content -->
  <div class="detail-body">
    <aside class="detail-poster">
      {#if posterUrl}
        <img
          src={posterUrl}
          alt={detail.title}
          class="poster-img"
        />
      {:else}
        <div class="poster-placeholder">Sem poster</div>
      {/if}
    </aside>

    <div class="detail-info">
      <!-- Meta row -->
      <div class="meta-row">
        {#if rating}
          <span class="meta-badge meta-rating">★ {rating}</span>
        {/if}
        {#if year}
          <span class="meta-badge">{year}</span>
        {/if}
        {#if runtimeStr}
          <span class="meta-badge">{runtimeStr}</span>
        {/if}
        {#if detail.episodes}
          <span class="meta-badge">{detail.episodes} episódios</span>
        {/if}
        {#if detail.chapters}
          <span class="meta-badge">{detail.chapters} capítulos</span>
        {/if}
        {#if detail.volumes}
          <span class="meta-badge">{detail.volumes} volumes</span>
        {/if}
        {#if detail.status}
          <span class="meta-badge">{detail.status}</span>
        {/if}
      </div>

      <!-- Studios / Author -->
      {#if detail.studios && detail.studios.length > 0}
        <p class="detail-studios">{detail.studios.join(', ')}</p>
      {/if}
      {#if detail.author}
        <p class="detail-author">{detail.author}</p>
      {/if}

      <!-- Genres -->
      {#if detail.genres.length > 0}
        <div class="genre-row">
          {#each detail.genres as genre (genre.id)}
            <span class="genre-pill">{genre.name}</span>
          {/each}
        </div>
      {/if}

      <!-- Overview -->
      {#if detail.overview}
        <p class="overview">{detail.overview}</p>
      {/if}

      <!-- Trailer -->
      {#if trailer}
        <div class="trailer-section">
          <h3 class="section-title">Trailer</h3>
          <div class="trailer-wrapper">
            <iframe
              src="https://www.youtube.com/embed/{trailer.key}?rel=0&modestbranding=1"
              title={trailer.name}
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      {/if}

      <!-- Cast -->
      {#if detail.cast.length > 0}
        <div class="cast-section">
          <h3 class="section-title">Elenco</h3>
          <div
            class="cast-scroll"
            class:grabbing={dragging}
            bind:this={castEl}
            onmousedown={onDragStart}
            onmousemove={onDragMove}
            onmouseup={onDragEnd}
            onmouseleave={onDragEnd}
            role="list"
          >
            {#each detail.cast as member (member.id)}
              <div class="cast-card">
                {#if member.profile_path}
                  <img
                    src={isTmdb ? TMDB_IMG.profile(member.profile_path) : member.profile_path}
                    alt={member.name}
                    class="cast-photo"
                    loading="lazy"
                  />
                {:else}
                  <div class="cast-photo-placeholder"></div>
                {/if}
                <span class="cast-name">{member.name}</span>
                <span class="cast-character">{member.character}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  // ── Hero ────────────────────────────────────────────────
  .hero {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 420px;
    overflow: hidden;
  }

  .hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      $color-bg-primary 0%,
      transparent 50%,
      rgba($color-bg-primary, 0.4) 100%
    );
  }

  .hero-content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: $spacing-xl $spacing-xl $spacing-lg;
    max-width: 1440px;
    margin-inline: auto;
  }

  .back-btn {
    background: rgba($color-bg-secondary, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: $color-text-main;
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.82rem;
    cursor: pointer;
    margin-bottom: $spacing-md;
    transition: background $dur-fast;
    &:hover {
      background: rgba($color-bg-secondary, 0.9);
    }
  }

  .hero-title {
    font-family: $font-display;
    font-size: 2.8rem;
    line-height: 1.1;
    color: $color-text-main;
    margin: 0;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  }

  .hero-tagline {
    font-size: 0.92rem;
    color: $color-text-muted;
    font-style: italic;
    margin: $spacing-xs 0 0;
  }

  // ── Detail body (2-col) ─────────────────────────────────
  .detail-body {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: $spacing-xl;
    max-width: 1440px;
    margin-inline: auto;
    padding: 0 $spacing-xl $spacing-2xl;
    position: relative;
    z-index: 1;
  }

  .detail-poster {
  }

  .detail-info {
    min-width: 0;
    padding-top: $spacing-md;
  }

  .poster-img {
    width: 100%;
    border-radius: $radius-lg;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }

  .poster-placeholder {
    width: 100%;
    aspect-ratio: 2/3;
    border-radius: $radius-lg;
    background: $color-bg-secondary;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $color-text-faint;
    font-size: 0.82rem;
  }

  // ── Meta ────────────────────────────────────────────────
  .meta-row {
    display: flex;
    gap: $spacing-sm;
    flex-wrap: wrap;
    margin-bottom: $spacing-md;
  }

  .detail-studios,
  .detail-author {
    font-size: 0.82rem;
    color: $color-text-muted;
    font-style: italic;
    margin-bottom: $spacing-md;
  }

  .meta-badge {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.78rem;
    color: $color-text-muted;
    font-family: $font-mono;
    letter-spacing: 0.04em;
  }

  .meta-rating {
    color: $color-primary;
    border-color: rgba($color-primary, 0.25);
  }

  // ── Genres ──────────────────────────────────────────────
  .genre-row {
    display: flex;
    gap: $spacing-xs;
    flex-wrap: wrap;
    margin-bottom: $spacing-lg;
  }

  .genre-pill {
    background: rgba($color-primary, 0.1);
    border: 1px solid rgba($color-primary, 0.2);
    color: $color-primary;
    padding: 2px $spacing-sm;
    border-radius: $radius-full;
    font-size: 0.72rem;
    font-family: $font-mono;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  // ── Overview ────────────────────────────────────────────
  .overview {
    font-size: 0.92rem;
    line-height: 1.7;
    color: $color-text-muted;
    margin-bottom: $spacing-xl;
  }

  // ── Trailer ─────────────────────────────────────────────
  .section-title {
    @include label-style;
    margin-bottom: $spacing-md;
  }

  .trailer-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: $radius-md;
    overflow: hidden;
    background: $color-bg-secondary;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: box-shadow $dur-normal $ease-out-expo;

    &:hover {
      box-shadow:
        0 0 0 2px $color-primary,
        0 8px 32px rgba(0, 0, 0, 0.5);
    }

    iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
  }

  .trailer-section {
    margin-bottom: $spacing-xl;
  }

  // ── Cast ────────────────────────────────────────────────
  .cast-section {
    margin-bottom: $spacing-xl;
  }

  .cast-scroll {
    display: flex;
    gap: $spacing-md;
    overflow-x: auto;
    padding-bottom: $spacing-sm;
    cursor: grab;
    user-select: none;

    &.grabbing {
      cursor: grabbing;
      scroll-behavior: auto;
    }

    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }
  }

  .cast-card {
    flex: 0 0 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 4px;
  }

  .cast-photo {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    background: $color-bg-secondary;
  }

  .cast-photo-placeholder {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: $color-bg-secondary;
  }

  .cast-name {
    font-size: 0.72rem;
    color: $color-text-main;
    font-weight: 500;
    @include truncate;
    max-width: 100%;
  }

  .cast-character {
    font-size: 0.66rem;
    color: $color-text-faint;
    @include truncate;
    max-width: 100%;
  }

  // ── Skeleton ────────────────────────────────────────────
  .detail-skeleton {
    .skeleton-hero {
      width: 100%;
      height: 420px;
      background: $color-bg-secondary;
    }

    .skeleton-body {
      display: grid;
      grid-template-columns: 260px 1fr;
      gap: $spacing-xl;
      max-width: 1440px;
      margin-inline: auto;
      padding: $spacing-lg $spacing-xl;
      margin-top: -80px;
      position: relative;
    }

    .skeleton-poster-ph {
      width: 100%;
      aspect-ratio: 2/3;
      background: $color-bg-secondary;
      border-radius: $radius-lg;
    }

    .skeleton-info {
      padding-top: 80px;
    }

    .skeleton-line {
      background: $color-bg-secondary;
      border-radius: $radius-sm;
      position: relative;
      overflow: hidden;
      &::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(
          100deg,
          transparent 0%,
          rgba(255, 255, 255, 0.04) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: shimmer 1.7s ease-in-out infinite;
      }
    }
  }

  // ── Error ───────────────────────────────────────────────
  .detail-error {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-lg $spacing-xl;
    max-width: 600px;
    margin: $spacing-2xl auto;
    background: rgba(255, 82, 99, 0.07);
    border: 1px solid rgba(255, 82, 99, 0.2);
    border-radius: $radius-md;
    color: #ff5263;
    font-size: 0.84rem;

    button {
      background: none;
      border: 1px solid rgba(255, 82, 99, 0.3);
      color: #ff5263;
      padding: $spacing-xs $spacing-sm;
      border-radius: $radius-sm;
      font-size: 0.76rem;
      cursor: pointer;
      white-space: nowrap;
      &:hover {
        background: rgba(255, 82, 99, 0.1);
      }
    }
  }

  // ── Responsive ──────────────────────────────────────────
  @include respond-to(md) {
    .hero {
      height: 300px;
    }
    .hero-title {
      font-size: 1.8rem;
    }
    .detail-body {
      grid-template-columns: 1fr;
    }
    .detail-skeleton .skeleton-body {
      grid-template-columns: 1fr;
    }
    .detail-poster {
      display: none;
    }
    .detail-info {
      padding-top: 0;
    }
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
