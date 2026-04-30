<script lang="ts">
  import { goto } from "$app/navigation";
  import { userStore } from "$lib/stores/user.svelte";

  function handleClick() {
    if (userStore.isLoggedIn) {
      goto("/watchlist");
    } else {
      goto("/auth");
    }
  }

  function handleLogout(e: MouseEvent) {
    e.stopPropagation();
    userStore.logout();
    goto("/auth");
  }
</script>

<div class="user-btn-wrap">
  <button class="user-btn" onclick={handleClick} type="button">
    {#if userStore.isLoggedIn && userStore.currentUser}
      <span class="user-avatar"
        >{userStore.currentUser.name[0].toUpperCase()}</span
      >
      <span class="user-name">{userStore.currentUser.name}</span>
    {:else}
      <span class="user-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
      <span class="user-label">Entrar</span>
    {/if}
  </button>

  {#if userStore.isLoggedIn}
    <button
      class="logout-btn"
      onclick={handleLogout}
      type="button"
      title="Sair"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  {/if}
</div>

<style lang="scss">
  .user-btn-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .user-btn {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: $radius-full;
    background: rgba(255, 255, 255, 0.04);
    color: $color-text-main;
    font-family: $font-body;
    font-size: 0.82rem;
    cursor: pointer;
    transition:
      background $dur-fast,
      border-color $dur-fast;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba($color-primary, 0.4);
    }
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: $color-primary;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    @include flex-center;
    flex-shrink: 0;
  }

  .user-name {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-icon {
    display: flex;
    align-items: center;
    color: $color-text-muted;
  }

  .user-label {
    color: $color-text-muted;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 50%;
    background: transparent;
    color: $color-text-faint;
    cursor: pointer;
    transition:
      background $dur-fast,
      color $dur-fast;

    &:hover {
      background: rgba(255, 80, 80, 0.12);
      color: #ff6b6b;
      border-color: rgba(255, 80, 80, 0.3);
    }
  }
</style>
