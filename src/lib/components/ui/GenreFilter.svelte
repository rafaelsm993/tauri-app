<script lang="ts">
  // ============================================================
  // GenreFilter — vertical list of genre options used as a sidebar
  // navigation. Renders nothing while loading data is empty for the
  // active category. Highlights the currently active genre.
  // ============================================================
  import type { GenreOption, GenreId } from "$lib/types/media";

  let {
    genres = [],
    active = null,
    loading = false,
    onchange,
  } = $props<{
    genres: GenreOption[];
    active: GenreId | null;
    loading?: boolean;
    onchange: (id: GenreId | null) => void;
  }>();
</script>

{#if loading}
  <ul class="genre-list" aria-hidden="true">
    {#each { length: 8 } as _}
      <li class="genre-skeleton"></li>
    {/each}
  </ul>
{:else if genres.length > 0}
  <ul class="genre-list" role="tablist" aria-label="Filtrar por gênero">
    <li>
      <button
        type="button"
        class="genre-item"
        class:active={active === null}
        role="tab"
        aria-selected={active === null}
        onclick={() => onchange(null)}
      >
        Todos
      </button>
    </li>
    {#each genres as g (g.id)}
      <li>
        <button
          type="button"
          class="genre-item"
          class:active={active === g.id}
          role="tab"
          aria-selected={active === g.id}
          onclick={() => onchange(g.id)}
        >
          {g.name}
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style lang="scss">
  .genre-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start; // shrink items to their own width
    gap: 2px;

    li {
      display: block;
    }
  }

  .genre-item {
    box-sizing: border-box;
    display: inline-block;
    width: auto;
    max-width: 100%;
    padding: 8px $spacing-sm;
    border: none;
    background: transparent;
    color: $color-text-muted;
    font-size: 0.82rem;
    font-weight: 500;
    text-align: left;
    border-radius: $radius-sm;
    border-left: 2px solid transparent;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      background $dur-fast ease,
      color $dur-fast ease,
      border-color $dur-fast ease;

    &:hover {
      background: rgba(255, 255, 255, 0.04);
      color: $color-text-main;
    }

    &:focus-visible {
      outline: 2px solid $color-primary;
      outline-offset: 2px;
    }

    &.active {
      color: $color-text-main;
      background: rgba($color-primary, 0.12);
      border-left-color: $color-primary;
      font-weight: 700;
    }
  }

  .genre-skeleton {
    list-style: none;
    height: 32px;
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
      animation: shimmer 1.7s ease-in-out infinite;
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
