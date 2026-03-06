<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  
  // Svelte 5: Definindo props com runas, incluindo o callback de pesquisa
  let { 
    placeholder = "Busque filmes, séries, animes...", 
    onSearch 
  } = $props<{
    placeholder?: string;
    onSearch?: (query: string) => void;
  }>();

  // Estado interno da barra de pesquisa
  let query = $state("");
  let isFocused = $state(false);
  let loading = $state(false);
  let submitted = $state(false);

  function handleSubmit(event: SubmitEvent) {
    // CRITICAL: prevent the form from doing a real HTTP submit (page reload)
    event.preventDefault();

    if (!query.trim()) return;

    loading   = true;
    submitted = false;

    if (onSearch) {
      onSearch(query.trim());
    }

    // Visual feedback — reset after 1.5 s
    setTimeout(() => {
      loading   = false;
      submitted = true;
      setTimeout(() => (submitted = false), 2000);
    }, 1500);
  }

  function handleClear() {
    query = "";
  }
</script>

<form 
  class="search-bar-container" 
  class:focused={isFocused}
  class:loading={loading}
  class:submitted={submitted}
  onsubmit={handleSubmit}
>
  <div class="glass-morph" aria-hidden="true"></div>
  
  <div class="icon-section">
    {#if loading}
      <div class="loader-spinner" transition:scale></div>
    {:else}
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    {/if}
  </div>

  <input
    type="text"
    bind:value={query}
    {placeholder}
    onfocus={() => isFocused = true}
    onblur={() => isFocused = false}
    aria-label="Campo de pesquisa"
  />

  {#if query.length > 0 && !loading}
    <button 
      type="button" 
      class="clear-button" 
      onclick={handleClear}
      in:scale={{duration: 200, easing: cubicOut}} 
      out:fade={{duration: 150}}
      aria-label="Limpar pesquisa"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  {/if}

</form>

<style lang="scss">
  // Usando SCSS para aninhamento e variáveis
  .search-bar-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 60px;
    border-radius: $radius-full;
    padding: 0 $spacing-sm;
    // Borda paramétrica sutil do seu global.css
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    overflow: hidden;

    // Efeito de Glassmorphism usando mixin do variables.scss
    .glass-morph {
      @include glass(15px);
      position: absolute;
      inset: 0;
      z-index: 0;
      background: rgba(26, 26, 26, 0.5);
    }

    // Estados Reativos da Barra
    &.focused {
      border-color: var(--clr-gold);
      box-shadow: 0 0 20px rgba(232, 184, 75, 0.3);
      background: rgba(26, 26, 26, 0.8);
    }

    &.loading {
      border-color: var(--clr-teal);
    }

    &.submitted {
      animation: pulseSuccess 0.5s ease-out;
    }
  }

  .icon-section {
    position: relative;
    z-index: 1;
    width: 50px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-icon {
    width: 24px;
    height: 24px;
    color: var(--clr-text-3);
    transition: color 0.3s ease;
  }

  .search-bar-container.focused .search-icon {
    color: var(--clr-gold);
  }

  .loader-spinner {
    width: 22px;
    height: 22px;
    border: 3px solid rgba(61, 217, 196, 0.2);
    border-top-color: var(--clr-teal);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  input {
    position: relative;
    z-index: 1;
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    color: var(--clr-text);
    font-size: var(--size-md);
    font-family: var(--font-body);
    padding: 0 $spacing-sm;

    &::placeholder {
      color: var(--clr-text-3);
      transition: color 0.3s ease;
    }
  }

  .search-bar-container.focused input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .clear-button {
    position: relative;
    z-index: 1;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: var(--clr-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-right: $spacing-sm;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      color: var(--clr-gold);
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }

  // Animações
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulseSuccess {
    0% { box-shadow: 0 0 0 0 rgba(61, 217, 196, 0.6); }
    70% { box-shadow: 0 0 0 15px rgba(61, 217, 196, 0); }
    100% { box-shadow: 0 0 0 0 rgba(61, 217, 196, 0); }
  }
</style>