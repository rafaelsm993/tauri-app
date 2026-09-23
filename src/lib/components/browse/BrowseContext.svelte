<script lang="ts">
  // One-line context above the results: search term, selected genre, or default.
  let { isSearch, query, genreName, onClearSearch, onAllGenres } = $props<{
    isSearch: boolean;
    query: string;
    genreName: string | null; // null = no genre selected
    onClearSearch: () => void;
    onAllGenres: () => void;
  }>();
</script>

<p class="page-context">
  {#if isSearch}
    Resultados para <strong>"{query}"</strong>
    <button class="link-btn" onclick={onClearSearch}>← Descobrir</button>
  {:else if genreName !== null}
    Populares em <strong>{genreName}</strong>
    <button class="link-btn" onclick={onAllGenres}> ← Todos os gêneros </button>
  {:else}
    Explorar por gênero
  {/if}
</p>

<style lang="scss">
  .page-context {
    font-size: 0.78rem;
    color: $color-text-faint;
    letter-spacing: 0.06em;
    text-transform: uppercase;

    strong {
      color: $color-text-muted;
      font-weight: 600;
      text-transform: none;
    }
  }

  .link-btn {
    background: none;
    border: none;
    color: $color-primary;
    font-size: 0.78rem;
    cursor: pointer;
    margin-left: $spacing-sm;
    padding: 0;
    text-decoration: underline;
    &:hover {
      color: $color-text-main;
    }
  }
</style>
