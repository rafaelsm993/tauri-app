<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  let { placeholder = "Busque filmes, séries, animes...", onSearch } = $props<{
    placeholder?: string;
    onSearch?: (query: string) => void;
  }>();

  let query = $state("");
  let isFocused = $state(false);
  let loading = $state(false);
  let submitted = $state(false);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    loading = true;
    submitted = false;
    onSearch?.(query.trim());
    setTimeout(() => {
      loading = false;
      submitted = true;
      setTimeout(() => (submitted = false), 2000);
    }, 1500);
  }

  function handleClear() {
    query = "";
  }
</script>

<form
  class="search-bar"
  class:focused={isFocused}
  class:loading
  class:submitted
  onsubmit={handleSubmit}
>
  <div class="icon-wrap">
    {#if loading}
      <div class="spinner" transition:scale></div>
    {:else}
      <svg
        class="search-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    {/if}
  </div>

  <input
    type="text"
    bind:value={query}
    {placeholder}
    onfocus={() => (isFocused = true)}
    onblur={() => (isFocused = false)}
    aria-label="Campo de pesquisa"
  />

  {#if query.length > 0 && !loading}
    <button
      type="button"
      class="clear-btn"
      onclick={handleClear}
      in:scale={{ duration: 200, easing: cubicOut }}
      out:fade={{ duration: 150 }}
      aria-label="Limpar pesquisa"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  {/if}
</form>

<style lang="scss">
  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
    width: min(560px, 100%);
    height: 52px;
    border-radius: $radius-full;
    padding: 0 $spacing-sm;
    /* Solid background — backdrop-filter unreliable across stacking contexts */
    background: rgba(10, 10, 10, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition:
      border-color $dur-normal $ease-out-expo,
      box-shadow $dur-normal $ease-out-expo,
      background $dur-normal $ease-out-expo;

    &.focused {
      border-color: $color-primary;
      box-shadow:
        0 0 0 3px rgba($color-primary, 0.15),
        0 4px 24px rgba(0, 0, 0, 0.4);
      background: rgba(10, 10, 10, 0.95);
    }

    &.loading {
      border-color: $color-teal;
    }

    &.submitted {
      animation: pulse-success 0.5s ease-out;
    }
  }

  /* ── Icon ─────────────────────────────────────────────── */
  .icon-wrap {
    flex-shrink: 0;
    width: 44px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-icon {
    width: 20px;
    height: 20px;
    color: $color-text-muted;
    transition: color $dur-normal ease;

    .focused & {
      color: $color-primary;
    }
  }

  /* ── Input ────────────────────────────────────────────── */
  input {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: $color-text-main;
    font-size: 0.95rem;
    font-family: $font-body;
    padding: 0 $spacing-xs;

    &::placeholder {
      color: $color-text-faint;
      transition: color $dur-normal ease;
    }

    .focused &::placeholder {
      color: rgba(255, 255, 255, 0.2);
    }
  }

  /* ── Spinner ──────────────────────────────────────────── */
  .spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba($color-primary, 0.2);
    border-top-color: $color-primary;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* ── Clear button ─────────────────────────────────────── */
  .clear-btn {
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: $color-text-muted;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-left: $spacing-xs;
    transition:
      background $dur-fast ease,
      color $dur-fast ease;

    &:hover {
      background: rgba(255, 255, 255, 0.16);
      color: $color-primary;
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  /* ── Animations ───────────────────────────────────────── */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse-success {
    0% {
      box-shadow: 0 0 0 0 rgba($color-primary, 0.6);
    }
    70% {
      box-shadow: 0 0 0 12px rgba($color-primary, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba($color-primary, 0);
    }
  }
</style>
