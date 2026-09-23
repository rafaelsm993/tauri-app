<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { MediaItem } from "$lib/types/media";
  import { BrowseStore } from "$lib/stores/browse.svelte";
  import SearchBar from "$lib/components/ui/SearchBar.svelte";
  import CategoryTabs from "$lib/components/ui/CategoryTabs.svelte";
  import GenreCarousel from "$lib/components/ui/GenreCarousel.svelte";
  import BackToTop from "$lib/components/ui/BackToTop.svelte";
  import BrowseSidebar from "$lib/components/browse/BrowseSidebar.svelte";
  import BrowseContext from "$lib/components/browse/BrowseContext.svelte";
  import ResultsGrid from "$lib/components/browse/ResultsGrid.svelte";

  const browse = new BrowseStore();

  const genreName = $derived(
    browse.activeGenre === null
      ? null
      : (browse.genres.find((g) => g.id === browse.activeGenre)?.name ?? "gênero"),
  );

  function openDetail(item: MediaItem) {
    goto(
      resolve("/media/[type]/[id]", {
        type: item.media_type,
        id: encodeURIComponent(String(item.id)),
      }),
    );
  }

  onMount(() => {
    browse.refreshView();
  });
</script>

<div class="page">
  <header class="page-header">
    <SearchBar
      onSearch={(q) => browse.search(q)}
      placeholder="Buscar filmes, séries, anime, mangá, livros…"
    />

    <CategoryTabs active={browse.activeCategory} onchange={(c) => browse.switchCategory(c)} />
  </header>

  <div class="page-body">
    <BrowseSidebar
      visible={!browse.isSearch}
      genres={browse.genres}
      active={browse.activeGenre}
      loading={browse.genresLoading}
      onchange={(id) => browse.switchGenre(id)}
    />

    <main class="main-col">
      <BrowseContext
        isSearch={browse.isSearch}
        query={browse.query}
        {genreName}
        onClearSearch={() => browse.clearSearch()}
        onAllGenres={() => browse.switchGenre(null)}
      />

      {#if browse.error && !browse.carouselMode}
        <div class="page-error">
          <span>⚠ {browse.error}</span>
          <button onclick={() => browse.loadGrid(browse.query)}>Tentar novamente</button>
        </div>
      {/if}

      {#if browse.carouselMode}
        {#if browse.sections.length === 0 && !browse.genresLoading}
          <p class="page-empty">Nenhum gênero disponível.</p>
        {:else}
          {#each browse.sections as section (section.genre.id)}
            <GenreCarousel
              title={section.genre.name}
              items={section.items}
              loading={section.loading}
              error={section.error}
              onCardClick={openDetail}
              onSeeMore={() => browse.switchGenre(section.genre.id)}
            />
          {/each}
        {/if}
      {:else}
        <ResultsGrid
          items={browse.items}
          loading={browse.loading}
          appending={browse.appending}
          hasMore={browse.hasMore}
          hasError={!!browse.error}
          onCardClick={openDetail}
          onLoadMore={() => browse.loadMore()}
        />
      {/if}
    </main>
  </div>
</div>

<BackToTop />

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

    @include respond-to(lg) {
      flex-direction: column;
    }
  }

  .main-col {
    flex: 1 1 0;
    min-width: 0; // critical: lets carousel rails overflow:auto kick in
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: $spacing-md;

    // Stacked layout: a 0 basis on the column axis collapses to 0 px under overflow: hidden.
    @include respond-to(lg) {
      flex: 0 0 auto;
      width: 100%;
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

  .page-empty {
    text-align: center;
    color: $color-text-faint;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    padding: $spacing-2xl 0;
  }
</style>
