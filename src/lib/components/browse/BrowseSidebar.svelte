<script lang="ts">
  // Sticky left sidebar holding the genre filter (hidden during search), so it
  // stays in reach while the user scrolls through carousels / grid results.
  import type { GenreId, GenreOption } from "$lib/types/media";
  import GenreFilter from "$lib/components/ui/GenreFilter.svelte";

  let { visible, genres, active, loading, onchange } = $props<{
    visible: boolean;
    genres: GenreOption[];
    active: GenreId | null;
    loading: boolean;
    onchange: (id: GenreId | null) => void;
  }>();
</script>

<aside class="sidebar" aria-label="Filtros">
  {#if visible}
    <div class="sidebar-section">
      <h3 class="sidebar-heading">Gêneros</h3>
      <GenreFilter {genres} {active} {loading} {onchange} />
    </div>
  {/if}
</aside>

<style lang="scss">
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

    @include respond-to(lg) {
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
</style>
