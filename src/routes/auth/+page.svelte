<script lang="ts">
  import { goto } from "$app/navigation";
  import { userStore } from "$lib/stores/user.svelte";
  import { watchlist } from "$lib/stores/watchlist.svelte";
  import { AuthAPI } from "$lib/api/auth";
  import type { User } from "$lib/types/media";

  // Redirect if already logged in
  $effect(() => {
    if (userStore.isLoggedIn) {
      goto("/", { replaceState: true });
    }
  });

  type Tab = "login" | "register";
  let tab = $state<Tab>("login");

  // Login form
  let loginEmail = $state("");
  let loginPassword = $state("");
  let loginError = $state("");
  let loginLoading = $state(false);

  // Register form
  let regName = $state("");
  let regEmail = $state("");
  let regPassword = $state("");
  let regConfirm = $state("");
  let regError = $state("");
  let regSuccess = $state(false);
  let regLoading = $state(false);

  // Existing profiles for quick selection
  let existingUsers = $state<User[]>([]);
  let profilesLoading = $state(true);

  $effect(() => {
    AuthAPI.listUsers()
      .then((users) => {
        existingUsers = users;
      })
      .catch(() => {
        existingUsers = [];
      })
      .finally(() => {
        profilesLoading = false;
      });
  });

  function selectProfile(user: User) {
    tab = "login";
    loginEmail = user.email;
    loginPassword = "";
    loginError = "";
  }

  async function handleLogin() {
    loginError = "";
    if (!loginEmail.trim()) {
      loginError = "Informe o email.";
      return;
    }
    if (!loginPassword) {
      loginError = "Informe a senha.";
      return;
    }

    loginLoading = true;
    try {
      await userStore.login(loginEmail.trim(), loginPassword);
      await watchlist.load();
      goto("/", { replaceState: true });
    } catch (e: any) {
      loginError =
        typeof e === "string" ? e : (e?.message ?? "Erro ao entrar.");
    } finally {
      loginLoading = false;
    }
  }

  async function handleRegister() {
    regError = "";
    regSuccess = false;
    if (!regName.trim()) {
      regError = "Informe o nome.";
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      regError = "Email inválido.";
      return;
    }
    if (regPassword.length < 4) {
      regError = "A senha deve ter pelo menos 4 caracteres.";
      return;
    }
    if (regPassword !== regConfirm) {
      regError = "As senhas não coincidem.";
      return;
    }

    regLoading = true;
    try {
      await AuthAPI.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      });
      // Redirect to login tab with email pre-filled
      loginEmail = regEmail.trim();
      loginPassword = "";
      loginError = "";
      regName = "";
      regEmail = "";
      regPassword = "";
      regConfirm = "";
      regSuccess = true;
      tab = "login";
      // Refresh profile list
      AuthAPI.listUsers()
        .then((users) => {
          existingUsers = users;
        })
        .catch(() => {});
    } catch (e: any) {
      regError =
        typeof e === "string" ? e : (e?.message ?? "Erro ao criar conta.");
    } finally {
      regLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent, action: () => void) {
    if (e.key === "Enter") action();
  }
</script>

<div class="auth-screen">
  <div class="auth-card">
    <!-- Brand -->
    <div class="auth-brand">
      <span class="auth-logo">TauriFlix</span>
    </div>

    <!-- Tabs -->
    <div class="auth-tabs" role="tablist">
      <button
        role="tab"
        class="auth-tab"
        class:active={tab === "login"}
        onclick={() => {
          tab = "login";
          loginError = "";
        }}
        aria-selected={tab === "login"}>Entrar</button
      >
      <button
        role="tab"
        class="auth-tab"
        class:active={tab === "register"}
        onclick={() => {
          tab = "register";
          regError = "";
        }}
        aria-selected={tab === "register"}>Criar Conta</button
      >
    </div>

    <!-- Login tab -->
    {#if tab === "login"}
      <div class="auth-panel">
        {#if regSuccess}
          <p class="auth-success" role="status">
            Conta criada com sucesso! Faça login para continuar.
          </p>
        {/if}

        <!-- Existing profiles -->
        {#if !profilesLoading && existingUsers.length > 0}
          <p class="auth-label">Selecionar perfil</p>
          <div class="profile-list">
            {#each existingUsers as u (u.id)}
              <button
                class="profile-chip"
                class:active={loginEmail === u.email}
                onclick={() => selectProfile(u)}
              >
                <span class="profile-avatar">{u.name[0].toUpperCase()}</span>
                <span class="profile-name">{u.name}</span>
              </button>
            {/each}
          </div>
        {/if}

        <div class="auth-field">
          <label for="login-email" class="auth-label">Email</label>
          <input
            id="login-email"
            type="email"
            class="auth-input"
            bind:value={loginEmail}
            placeholder="seu@email.com"
            autocomplete="email"
            onkeydown={(e) => handleKeydown(e, handleLogin)}
          />
        </div>

        <div class="auth-field">
          <label for="login-pass" class="auth-label">Senha</label>
          <input
            id="login-pass"
            type="password"
            class="auth-input"
            bind:value={loginPassword}
            placeholder="••••••"
            autocomplete="current-password"
            onkeydown={(e) => handleKeydown(e, handleLogin)}
          />
        </div>

        {#if loginError}
          <p class="auth-error" role="alert">{loginError}</p>
        {/if}

        <button class="auth-btn" onclick={handleLogin} disabled={loginLoading}>
          {loginLoading ? "Entrando…" : "Entrar"}
        </button>
      </div>

      <!-- Register tab -->
    {:else}
      <div class="auth-panel">
        <div class="auth-field">
          <label for="reg-name" class="auth-label">Nome</label>
          <input
            id="reg-name"
            type="text"
            class="auth-input"
            bind:value={regName}
            placeholder="Seu nome"
            autocomplete="name"
            onkeydown={(e) => handleKeydown(e, handleRegister)}
          />
        </div>

        <div class="auth-field">
          <label for="reg-email" class="auth-label">Email</label>
          <input
            id="reg-email"
            type="email"
            class="auth-input"
            bind:value={regEmail}
            placeholder="seu@email.com"
            autocomplete="email"
            onkeydown={(e) => handleKeydown(e, handleRegister)}
          />
        </div>

        <div class="auth-field">
          <label for="reg-pass" class="auth-label">Senha</label>
          <input
            id="reg-pass"
            type="password"
            class="auth-input"
            bind:value={regPassword}
            placeholder="Mínimo 4 caracteres"
            autocomplete="new-password"
            onkeydown={(e) => handleKeydown(e, handleRegister)}
          />
        </div>

        <div class="auth-field">
          <label for="reg-confirm" class="auth-label">Confirmar Senha</label>
          <input
            id="reg-confirm"
            type="password"
            class="auth-input"
            bind:value={regConfirm}
            placeholder="Repita a senha"
            autocomplete="new-password"
            onkeydown={(e) => handleKeydown(e, handleRegister)}
          />
        </div>

        {#if regError}
          <p class="auth-error" role="alert">{regError}</p>
        {/if}

        <button class="auth-btn" onclick={handleRegister} disabled={regLoading}>
          {regLoading ? "Criando conta…" : "Criar Conta"}
        </button>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .auth-screen {
    position: fixed;
    inset: 0;
    @include flex-center;
    z-index: var(--z-modal);
    padding: $spacing-md;
  }

  .auth-card {
    @include glass(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: $radius-xl;
    padding: $spacing-2xl $spacing-xl;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  .auth-brand {
    text-align: center;
  }

  .auth-logo {
    font-family: $font-display;
    font-size: 2.4rem;
    letter-spacing: 0.05em;
    color: $color-primary;
  }

  // ── Tabs ────────────────────────────────────────────────────
  .auth-tabs {
    display: flex;
    background: rgba(255, 255, 255, 0.04);
    border-radius: $radius-lg;
    padding: 3px;
    gap: 3px;
  }

  .auth-tab {
    flex: 1;
    padding: $spacing-sm $spacing-md;
    border: none;
    border-radius: calc($radius-lg - 2px);
    background: transparent;
    color: $color-text-muted;
    font-family: $font-body;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background $dur-normal $ease-out-expo,
      color $dur-normal $ease-out-expo;

    &.active {
      background: $color-primary;
      color: #fff;
    }

    &:hover:not(.active) {
      background: rgba(255, 255, 255, 0.06);
      color: $color-text-main;
    }
  }

  // ── Panel ───────────────────────────────────────────────────
  .auth-panel {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  // ── Profiles ────────────────────────────────────────────────
  .profile-list {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  .profile-chip {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-xs $spacing-sm;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: $radius-full;
    background: rgba(255, 255, 255, 0.04);
    color: $color-text-muted;
    font-family: $font-body;
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      border-color $dur-fast,
      background $dur-fast,
      color $dur-fast;

    &:hover,
    &.active {
      border-color: $color-primary;
      background: rgba($color-primary, 0.12);
      color: $color-text-main;
    }
  }

  .profile-avatar {
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

  .profile-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // ── Fields ──────────────────────────────────────────────────
  .auth-field {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  .auth-label {
    font-size: 0.78rem;
    color: $color-text-muted;
    font-weight: 500;
    letter-spacing: 0.03em;
  }

  .auth-input {
    width: 100%;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-md;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: $color-text-main;
    font-family: $font-body;
    font-size: 0.9rem;
    box-sizing: border-box;
    transition: border-color $dur-fast;
    outline: none;

    &::placeholder {
      color: $color-text-faint;
    }

    &:focus {
      border-color: rgba($color-primary, 0.6);
      background: rgba(255, 255, 255, 0.07);
    }
  }

  // ── Submit button ───────────────────────────────────────────
  .auth-btn {
    margin-top: $spacing-xs;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-md;
    border: none;
    background: $color-primary;
    color: #fff;
    font-family: $font-body;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background $dur-fast,
      opacity $dur-fast;

    &:hover:not(:disabled) {
      background: $color-accent;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }

  // ── Error ───────────────────────────────────────────────────
  .auth-error {
    font-size: 0.8rem;
    color: #ff6b6b;
    margin: 0;
    padding: $spacing-xs $spacing-sm;
    background: rgba(255, 80, 80, 0.1);
    border-radius: $radius-sm;
    border-left: 2px solid #ff6b6b;
  }

  // ── Success ─────────────────────────────────────────────────
  .auth-success {
    font-size: 0.8rem;
    color: #6bffb8;
    margin: 0;
    padding: $spacing-xs $spacing-sm;
    background: rgba(80, 255, 160, 0.1);
    border-radius: $radius-sm;
    border-left: 2px solid #6bffb8;
  }
</style>
