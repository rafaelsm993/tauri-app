<script lang="ts">
  import type { MediaItem, WatchlistStatus } from "$lib/types/media";
  import { watchlist } from "$lib/stores/watchlist.svelte";
  import { userStore } from "$lib/stores/user.svelte";

  let { item, compact = false } = $props<{
    item: MediaItem;
    compact?: boolean;
  }>();

  let showDropdown = $state(false);
  let containerEl = $state<HTMLDivElement | undefined>(undefined);

  const isLoggedIn = $derived(userStore.isLoggedIn);
  const inList = $derived(watchlist.isInWatchlist(item.id));
  const currentStatus = $derived(watchlist.getStatus(item.id));

  const statusLabels: Record<WatchlistStatus, string> = {
    want: "Quero Assistir",
    watching: "Assistindo",
    watched: "Assistido",
  };

  const statusIcons: Record<WatchlistStatus, string> = {
    want: "🔖",
    watching: "▶",
    watched: "✓",
  };

  $effect(() => {
    if (!showDropdown) return;
    function handleOutsideClick(e: MouseEvent) {
      if (containerEl && !containerEl.contains(e.target as Node)) {
        showDropdown = false;
      }
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  });

  async function handleAdd(status: WatchlistStatus, e: MouseEvent) {
    e.stopPropagation();
    showDropdown = false;
    await watchlist.add(item, status);
  }

  async function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    showDropdown = false;
    await watchlist.remove(item.id);
  }

  async function handleStatusChange(status: WatchlistStatus, e: MouseEvent) {
    e.stopPropagation();
    showDropdown = false;
    await watchlist.updateStatus(item.id, status);
  }

  function toggleDropdown(e: MouseEvent) {
    e.stopPropagation();
    showDropdown = !showDropdown;
  }
</script>

{#if isLoggedIn}
  <div class="wl-btn-wrap" class:compact bind:this={containerEl}>
    {#if !inList}
      <!-- Not in list: show add button -->
      <button
        class="wl-btn wl-btn--add"
        onclick={toggleDropdown}
        title="Adicionar à lista"
        aria-label="Adicionar à lista"
        aria-expanded={showDropdown}
      >
        <span class="wl-icon">＋</span>
        {#if !compact}<span class="wl-label">Minha Lista</span>{/if}
      </button>
    {:else}
      <!-- In list: show current status button -->
      <button
        class="wl-btn wl-btn--active"
        onclick={toggleDropdown}
        title={currentStatus ? statusLabels[currentStatus] : ""}
        aria-label="Opções da lista"
        aria-expanded={showDropdown}
      >
        <span class="wl-icon"
          >{currentStatus ? statusIcons[currentStatus] : "✓"}</span
        >
        {#if !compact && currentStatus}
          <span class="wl-label">{statusLabels[currentStatus]}</span>
        {/if}
      </button>
    {/if}

    <!-- Dropdown -->
    {#if showDropdown}
      <div class="wl-dropdown" role="menu">
        {#if !inList}
          {#each Object.entries(statusLabels) as [key, label] (key)}
            <button
              class="wl-option"
              role="menuitem"
              onclick={(e) => handleAdd(key as WatchlistStatus, e)}
            >
              <span class="wl-option-icon"
                >{statusIcons[key as WatchlistStatus]}</span
              >
              {label}
            </button>
          {/each}
        {:else}
          {#each Object.entries(statusLabels) as [key, label] (key)}
            <button
              class="wl-option"
              class:current={currentStatus === key}
              role="menuitem"
              onclick={(e) => handleStatusChange(key as WatchlistStatus, e)}
            >
              <span class="wl-option-icon"
                >{statusIcons[key as WatchlistStatus]}</span
              >
              {label}
            </button>
          {/each}
          <div class="wl-divider"></div>
          <button
            class="wl-option wl-option--remove"
            role="menuitem"
            onclick={handleRemove}
          >
            <span class="wl-option-icon">✕</span>
            Remover da lista
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .wl-btn-wrap {
    position: relative;

    &.compact {
      .wl-btn {
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 50%;
        @include flex-center;
      }
    }
  }

  .wl-btn {
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    padding: $spacing-xs $spacing-md;
    border-radius: $radius-full;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.5);
    color: $color-text-main;
    font-family: $font-body;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background $dur-fast,
      border-color $dur-fast;
    white-space: nowrap;
    backdrop-filter: blur(6px);

    &:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.5);
    }

    &--active {
      border-color: $color-teal;
      color: $color-teal;
      background: rgba($color-teal, 0.12);

      &:hover {
        background: rgba($color-teal, 0.2);
      }
    }
  }

  .wl-icon {
    font-size: 0.9em;
    line-height: 1;
  }

  // ── Dropdown ────────────────────────────────────────────────
  .wl-dropdown {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 180px;
    border-radius: $radius-lg;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(18, 18, 18, 0.96);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    z-index: var(--z-overlay);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  }

  .wl-option {
    width: 100%;
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border: none;
    background: transparent;
    color: $color-text-muted;
    font-family: $font-body;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
    transition:
      background $dur-fast,
      color $dur-fast;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: $color-text-main;
    }

    &.current {
      color: $color-teal;
    }

    &--remove {
      color: rgba(255, 100, 100, 0.7);
      &:hover {
        color: #ff6464;
        background: rgba(255, 60, 60, 0.08);
      }
    }
  }

  .wl-option-icon {
    width: 16px;
    text-align: center;
    font-size: 0.8em;
    flex-shrink: 0;
  }

  .wl-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 2px 0;
  }
</style>
