<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import UserButton from "$lib/components/ui/UserButton.svelte";
  import type { Snippet } from "svelte";

  let { children } = $props<{ children: Snippet }>();

  // Auth guard
  $effect(() => {
    if (!userStore.isLoggedIn && $page.url.pathname !== "/auth") {
      goto("/auth", { replaceState: true });
    }
    if (userStore.isLoggedIn && $page.url.pathname === "/auth") {
      goto("/", { replaceState: true });
    }
  });

  function handleLogout() {
    watchlist.clear();
    userStore.logout();
  }
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
