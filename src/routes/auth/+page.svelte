<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/user.svelte';
  import { watchlist } from '$lib/stores/watchlist.svelte';
  import type { User } from '$lib/types/media';

  // Redirect if already logged in
  $effect(() => {
    if (userStore.isLoggedIn) {
      goto('/', { replaceState: true });
    }
  });

  type Tab = 'login' | 'register';
  let tab = $state<Tab>('login');

  // Login form
  let loginUsername = $state('');
  let loginPassword = $state('');
  let loginError = $state('');
  let loginLoading = $state(false);

  // Register form
  let regUsername = $state('');
  let regPassword = $state('');
  let regConfirm = $state('');
  let regError = $state('');
  let regSuccess = $state(false);
  let regLoading = $state(false);

  // Google OAuth state
  type GooglePending = {
    google_id: string;
    email: string;
    suggested_name: string;
    avatar_url: string;
  };
  let googleLoading = $state(false);
  let googleError = $state('');
  let googleCancelled = $state(false);
  let googleRegisterSuccess = $state(false);
  let googlePending = $state<GooglePending | null>(null);
  let googleUsername = $state('');
  let googleUsernameError = $state('');
  let googleUsernameLoading = $state(false);

  async function finishLogin(user: User) {
    await watchlist.loadForUser(user.id);
    userStore.login(user);
    goto('/', { replaceState: true });
  }

  async function handleLogin() {
    loginError = '';
    if (!loginUsername.trim()) { loginError = 'Informe o nome de usuário.'; return; }
    if (!loginPassword) { loginError = 'Informe a senha.'; return; }

    loginLoading = true;
    try {
      const user = await invoke<User>('login_user', {
        username: loginUsername.trim(),
        password: loginPassword,
      });
      await finishLogin(user);
    } catch (e: any) {
      loginError = typeof e === 'string' ? e : (e?.message ?? 'Erro ao entrar.');
    } finally {
      loginLoading = false;
    }
  }

  async function handleRegister() {
    regError = '';
    regSuccess = false;
    if (!regUsername.trim()) { regError = 'Informe o nome de usuário.'; return; }
    if (regPassword.length < 6) { regError = 'A senha deve ter pelo menos 6 caracteres.'; return; }
    if (regPassword !== regConfirm) { regError = 'As senhas não coincidem.'; return; }

    regLoading = true;
    try {
      await invoke('register_user', {
        username: regUsername.trim(),
        password: regPassword,
      });
      loginUsername = regUsername.trim();
      loginPassword = '';
      loginError = '';
      regUsername = '';
      regPassword = '';
      regConfirm = '';
      regSuccess = true;
      tab = 'login';
    } catch (e: any) {
      regError = typeof e === 'string' ? e : (e?.message ?? 'Erro ao criar conta.');
    } finally {
      regLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent, action: () => void) {
    if (e.key === 'Enter') action();
  }

  type GoogleLoginResult =
    | { type: 'loggedIn' } & User
    | { type: 'needsUsername'; google_id: string; email: string; suggested_name: string; avatar_url: string };

  async function handleGoogleLogin() {
    googleError = '';
    googleCancelled = false;
    googleRegisterSuccess = false;
    googleLoading = true;
    try {
      const result = await invoke<GoogleLoginResult>('google_login');
      if (googleCancelled) return;
      if (result.type === 'loggedIn') {
        if (tab === 'register') {
          googleError = 'Esta conta Google já está registrada. Vá para a aba "Entrar" para acessar.';
          return;
        }
        await finishLogin(result as unknown as User);
      } else {
        googlePending = {
          google_id: result.google_id,
          email: result.email,
          suggested_name: result.suggested_name,
          avatar_url: result.avatar_url,
        };
        googleUsername = result.suggested_name;
      }
    } catch (e: any) {
      if (googleCancelled) return;
      const msg = typeof e === 'string' ? e : (e?.message ?? '');
      // User cancelled in Google's page — silently reset (browser already shows cancellation)
      if (msg.includes('cancelou')) return;
      googleError = msg || 'Erro ao entrar com Google.';
    } finally {
      googleLoading = false;
    }
  }

  function cancelGoogleLogin() {
    googleCancelled = true;
    googleLoading = false;
    googleError = '';
    // Signal the backend so the loopback thread returns "cancelada" to the browser.
    invoke('cancel_google_login').catch(() => {});
  }

  async function handleCompleteGoogleRegistration() {
    if (!googlePending) return;
    googleUsernameError = '';
    if (!googleUsername.trim()) { googleUsernameError = 'Informe um nome de usuário.'; return; }

    googleUsernameLoading = true;
    try {
      await invoke<User>('complete_google_registration', {
        username: googleUsername.trim(),
        googleId: googlePending.google_id,
        email: googlePending.email,
        avatarUrl: googlePending.avatar_url,
      });
      googlePending = null;
      googleUsername = '';
      googleRegisterSuccess = true;
      tab = 'login';
    } catch (e: any) {
      googleUsernameError = typeof e === 'string' ? e : (e?.message ?? 'Erro ao criar conta.');
    } finally {
      googleUsernameLoading = false;
    }
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
        class:active={tab === 'login'}
        onclick={() => { tab = 'login'; loginError = ''; googleError = ''; }}
        aria-selected={tab === 'login'}
      >Entrar</button>
      <button
        role="tab"
        class="auth-tab"
        class:active={tab === 'register'}
        onclick={() => { tab = 'register'; regError = ''; googleError = ''; googleRegisterSuccess = false; }}
        aria-selected={tab === 'register'}
      >Criar Conta</button>
    </div>

    <!-- Login tab -->
    {#if tab === 'login'}
      <div class="auth-panel">
        {#if regSuccess}
          <p class="auth-success" role="status">Conta criada com sucesso! Faça login para continuar.</p>
        {/if}

        <div class="auth-field">
          <label for="login-user" class="auth-label">Usuário</label>
          <input
            id="login-user"
            type="text"
            class="auth-input"
            bind:value={loginUsername}
            placeholder="Nome de usuário"
            autocomplete="username"
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

        <button
          class="auth-btn"
          onclick={handleLogin}
          disabled={loginLoading}
        >
          {loginLoading ? 'Entrando…' : 'Entrar'}
        </button>

        <div class="auth-divider"><span>ou</span></div>

        {#if googleError}
          <p class="auth-error" role="alert">{googleError}</p>
        {/if}

        <button
          class="auth-btn-google"
          onclick={handleGoogleLogin}
          disabled={googleLoading}
        >
          {#if !googleLoading}
            <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          {/if}
          {googleLoading ? 'Abrindo Google…' : 'Entrar com Google'}
        </button>
        {#if googleLoading}
          <button class="google-cancel-btn" onclick={cancelGoogleLogin}>
            Cancelar autenticação
          </button>
        {/if}
      </div>

    <!-- Register tab -->
    {:else}
      <div class="auth-panel">
        {#if googleRegisterSuccess}
          <p class="auth-success" role="status">Conta criada com sucesso! Clique em "Entrar com Google" para entrar.</p>
        {/if}
        <div class="auth-field">
          <label for="reg-user" class="auth-label">Usuário</label>
          <input
            id="reg-user"
            type="text"
            class="auth-input"
            bind:value={regUsername}
            placeholder="Escolha um nome de usuário"
            autocomplete="username"
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
            placeholder="Mínimo 6 caracteres"
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

        <button
          class="auth-btn"
          onclick={handleRegister}
          disabled={regLoading}
        >
          {regLoading ? 'Criando conta…' : 'Criar Conta'}
        </button>

        <div class="auth-divider"><span>ou</span></div>

        {#if googleError}
          <p class="auth-error" role="alert">{googleError}</p>
        {/if}

        <button
          class="auth-btn-google"
          onclick={handleGoogleLogin}
          disabled={googleLoading}
        >
          {#if !googleLoading}
            <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          {/if}
          {googleLoading ? 'Abrindo Google…' : 'Registrar com Google'}
        </button>
        {#if googleLoading}
          <button class="google-cancel-btn" onclick={cancelGoogleLogin}>
            Cancelar autenticação
          </button>
        {/if}
      </div>
    {/if}

    <!-- Google: choose username step -->
    {#if googlePending}
      <div class="google-pending-overlay">
        <div class="google-pending-card">
          <img
            src={googlePending.avatar_url}
            alt="Foto do Google"
            class="google-pending-avatar"
            referrerpolicy="no-referrer"
          />
          <p class="google-pending-email">{googlePending.email}</p>
          <p class="google-pending-hint">Escolha um nome de usuário para exibição no TauriFlix:</p>

          <div class="auth-field">
            <label for="google-username" class="auth-label">Nome de usuário</label>
            <input
              id="google-username"
              type="text"
              class="auth-input"
              bind:value={googleUsername}
              placeholder="Ex: joaosilva"
              autocomplete="username"
              onkeydown={(e) => { if (e.key === 'Enter') handleCompleteGoogleRegistration(); }}
            />
          </div>

          {#if googleUsernameError}
            <p class="auth-error" role="alert">{googleUsernameError}</p>
          {/if}

          <button
            class="auth-btn"
            onclick={handleCompleteGoogleRegistration}
            disabled={googleUsernameLoading}
          >
            {googleUsernameLoading ? 'Criando conta…' : 'Confirmar'}
          </button>

          <button
            class="google-pending-cancel"
            onclick={() => { googlePending = null; googleError = ''; }}
          >Cancelar</button>
        </div>
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
    transition: background $dur-normal $ease-out-expo, color $dur-normal $ease-out-expo;

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
    transition: background $dur-fast, opacity $dur-fast;

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

  // ── Divider ─────────────────────────────────────────────────
  .auth-divider {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    color: $color-text-faint;
    font-size: 0.75rem;

    &::before, &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
    }
  }

  // ── Google button ────────────────────────────────────────────
  .auth-btn-google {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
    border-radius: $radius-md;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: $color-text-main;
    font-family: $font-body;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background $dur-fast, border-color $dur-fast;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }

  // ── Cancel Google auth ───────────────────────────────────────
  .google-cancel-btn {
    align-self: center;
    background: none;
    border: none;
    color: $color-text-faint;
    font-family: $font-body;
    font-size: 0.78rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color $dur-fast;

    &:hover {
      color: $color-text-muted;
    }
  }

  .google-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  // ── Google pending overlay ───────────────────────────────────
  .google-pending-overlay {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-modal) + 10);
    @include flex-center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    padding: $spacing-md;
  }

  .google-pending-card {
    @include glass(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: $radius-xl;
    padding: $spacing-2xl $spacing-xl;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-md;
  }

  .google-pending-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.15);
    object-fit: cover;
  }

  .google-pending-email {
    font-size: 0.85rem;
    color: $color-text-muted;
    margin: 0;
  }

  .google-pending-hint {
    font-size: 0.85rem;
    color: $color-text-muted;
    margin: 0;
    text-align: center;
    line-height: 1.4;
  }

  .google-pending-card .auth-field {
    width: 100%;
  }

  .google-pending-card .auth-btn {
    width: 100%;
  }

  .google-pending-cancel {
    background: none;
    border: none;
    color: $color-text-faint;
    font-family: $font-body;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0;
    transition: color $dur-fast;

    &:hover {
      color: $color-text-muted;
    }
  }
</style>
