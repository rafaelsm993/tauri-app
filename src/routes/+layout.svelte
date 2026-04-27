<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { userStore } from "$lib/stores/user.svelte";
  import { watchlist } from "$lib/stores/watchlist.svelte";
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

{#if userStore.isLoggedIn}
  <nav class="navbar">
    <a href="/" class="navbar-brand">TauriFlix</a>
    <div class="navbar-links">
      <a href="/" class="navbar-link" class:active={$page.url.pathname === "/"}>Home</a>
      <a href="/watchlist" class="navbar-link" class:active={$page.url.pathname === "/watchlist"}>
        Watchlist
        {#if watchlist.items.length > 0}
          <span class="navbar-badge">{watchlist.items.length}</span>
        {/if}
      </a>
    </div>
    <div class="navbar-user">
      <span class="navbar-username">
        <span class="navbar-avatar">{userStore.currentUser?.username[0].toUpperCase()}</span>
        {userStore.currentUser?.username}
      </span>
      <button class="navbar-logout" onclick={handleLogout}>Sair</button>
    </div>
  </nav>
{/if}

<div class="app-content" class:has-nav={userStore.isLoggedIn}>
  {@render children()}
</div>

<style lang="scss">
  // ── Navbar ──────────────────────────────────────────────────
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-overlay);
    height: 56px;
    padding: 0 $spacing-xl;
    @include flex-between;
    background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .navbar-brand {
    font-family: $font-display;
    font-size: 1.5rem;
    letter-spacing: 0.05em;
    color: $color-primary;
    text-decoration: none;
    flex-shrink: 0;
  }

  .navbar-links {
    display: flex;
    align-items: center;
    gap: $spacing-lg;
  }

  .navbar-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    color: $color-text-muted;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    padding: $spacing-xs 0;
    transition: color $dur-fast;

    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: $color-primary;
      border-radius: $radius-full;
      transform: scaleX(0);
      transition: transform $dur-normal $ease-out-expo;
    }

    &:hover, &.active {
      color: $color-text-main;
    }

    &.active::after {
      transform: scaleX(1);
    }
  }

  .navbar-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: $radius-full;
    background: $color-primary;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
  }

  .navbar-user {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex-shrink: 0;
  }

  .navbar-username {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    color: $color-text-muted;
    font-size: 0.85rem;
  }

  .navbar-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: $color-primary;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .navbar-logout {
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-sm;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: $color-text-muted;
    font-size: 0.8rem;
    font-family: $font-body;
    cursor: pointer;
    transition: border-color $dur-fast, color $dur-fast, background $dur-fast;

    &:hover {
      border-color: rgba($color-primary, 0.5);
      color: $color-text-main;
      background: rgba($color-primary, 0.08);
    }
  }

  // ── Content offset when navbar present ──────────────────────
  .app-content {
    &.has-nav {
      padding-top: 56px;
    }
  }
</style>
