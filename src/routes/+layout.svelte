<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import UserButton from "$lib/components/ui/UserButton.svelte";
  import type { Snippet } from "svelte";

  let { children } = $props<{ children: Snippet }>();
</script>

<AppBackground />
<div class="app-content">
  <nav class="app-nav">
    <UserButton />
  </nav>
  {@render children()}
</div>

<style lang="scss">
  .app-nav {
    position: fixed;
    top: $spacing-md;
    right: $spacing-md;
    z-index: var(--z-raised);
  }
</style>
