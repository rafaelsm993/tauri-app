<script lang="ts">
  import type { MediaType } from "$lib/types/media";

  type Category = { key: MediaType; label: string };

  const CATEGORIES: Category[] = [
    { key: "movie", label: "Filmes" },
    { key: "tv", label: "Séries" },
    { key: "anime", label: "Anime" },
    { key: "manga", label: "Mangá" },
    { key: "book", label: "Livros" },
  ];

  let { active, onchange } = $props<{
    active: MediaType;
    onchange: (category: MediaType) => void;
  }>();
</script>

<nav class="category-tabs" aria-label="Categorias">
  {#each CATEGORIES as cat (cat.key)}
    <button
      class="category-tab"
      class:active={active === cat.key}
      onclick={() => onchange(cat.key)}
    >
      {cat.label}
    </button>
  {/each}
</nav>

<style lang="scss">
  .category-tabs {
    display: flex;
    gap: $spacing-xs;
    padding: 3px;
    background: $color-bg-secondary;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: $radius-full;
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
  }
</style>
