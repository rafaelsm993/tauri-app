<script lang="ts">
  import type { Snippet } from "svelte";
  import type { MediaType } from "$lib/types/media";

  type Category = { key: MediaType; label: string };

  const CATEGORIES: Category[] = [
    { key: "movie", label: "Filmes" },
    { key: "tv", label: "Séries" },
    { key: "anime", label: "Anime" },
    { key: "manga", label: "Mangá" },
    { key: "book", label: "Livros" },
    { key: "game", label: "Jogos" },
  ];

  let { active, onchange, trailing } = $props<{
    active: MediaType;
    onchange: (category: MediaType) => void;
    // Optional control after the tabs (e.g. a filter). Lives outside the scrolling
    // nav so its popups are never clipped and it isn't announced as a category.
    trailing?: Snippet;
  }>();
</script>

<div class="category-bar">
  <nav class="category-tabs" aria-label="Categorias">
    {#each CATEGORIES as cat (cat.key)}
      <button
        type="button"
        class="category-tab"
        class:active={active === cat.key}
        aria-pressed={active === cat.key}
        onclick={() => onchange(cat.key)}
      >
        {cat.label}
      </button>
    {/each}
  </nav>
  {#if trailing}
    <span class="category-bar__divider" aria-hidden="true"></span>
    {@render trailing()}
  {/if}
</div>

<style lang="scss">
  // The pill lives on the bar; only the tab list scrolls inside it.
  .category-bar {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: 3px;
    background: $color-bg-secondary;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: $radius-full;
    max-width: 100%;
    min-width: 0;
  }

  .category-bar__divider {
    flex: 0 0 auto;
    width: 1px;
    height: 1.1em;
    background: rgba(255, 255, 255, 0.12);
  }

  .category-tabs {
    display: flex;
    gap: $spacing-xs;
    min-width: 0;
    border-radius: $radius-full;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  .category-tab {
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    font-size: 0.76rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: $color-text-faint;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all $dur-normal ease;

    &:hover {
      color: $color-text-main;
      background: rgba(255, 255, 255, 0.05);
    }

    &.active {
      color: $color-bg-primary;
      background: $color-primary;
      font-weight: 700;
      box-shadow: 0 0 12px rgba($color-primary, 0.3);
    }

    flex: 0 0 auto;
    white-space: nowrap;

    @include touch {
      min-height: $touch-target;
      padding-inline: $spacing-md;
    }
  }
</style>
