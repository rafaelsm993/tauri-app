# TauriFlix — Project Guidelines

## Architecture

Tauri 2 desktop app: SvelteKit SPA (frontend) + Rust (backend), bridged via Tauri IPC `invoke()`.

Media providers: TMDB (movies/TV), AniList (anime/manga), RAWG (games), and iTunes (books). Optional cloud auth/watchlist requests use `fetch()` in `src/lib/api/cloud.ts`, not Tauri IPC.

| Layer                           | Location                                            |
| ------------------------------- | --------------------------------------------------- |
| Frontend (Svelte 5, TypeScript) | `src/`                                              |
| Backend (Rust, reqwest, serde)  | `src-tauri/src/`                                    |
| IPC bridge                      | `src/lib/api/*.ts` ↔ `src-tauri/src/api/*.rs`       |
| Types                           | `src/lib/types/media.ts`                            |
| Styles                          | `src/lib/styles/` (SCSS auto-injected + CSS tokens) |

## Code Style

- **Svelte 5 runes**: `$state`, `$derived`, `$effect`, `$props` — no legacy `writable()`/`readable()`
- **Event handlers**: `onclick`, `oninput` (Svelte 5 syntax) — never `on:click`
- **SCSS**: Variables and mixins auto-injected. **NEVER** add `@use`, `@import`, or `@forward` in `<style lang="scss">` blocks
- **Rust media commands**: `async fn` returning `Result<Value, String>`; local auth/watchlist commands return typed results, and scaffold `greet` is synchronous. Register commands in `lib.rs` via `generate_handler![]`
- **API keys**: `TMDB_API_KEY` and `RAWG_API_KEY` must be defined at compile time (`build.rs` reads the root `.env`); runtime environment values take priority — never hardcode

## Build and Test

| Command                       | Purpose                   |
| ----------------------------- | ------------------------- |
| `npm run tauri dev`           | Dev server (Vite + Tauri) |
| `npm run tauri build`         | Production build          |
| `npm run check`               | SvelteKit type check      |
| `cd src-tauri && cargo check` | Rust type check           |

## Conventions

- SPA only: `adapter-static`, `ssr = false`, no server routes
- All media APIs map to shared types in `src/lib/types/media.ts`
- Stores: class-based singletons in `src/lib/stores/*.svelte.ts`
- Register new Rust modules in `api/mod.rs` and new commands in `lib.rs`
- Component styles use SCSS design tokens directly (`$color-primary`, `$spacing-md`, `@include glass`)
- Palette: `$color-primary` is Netflix red (`#E50914`), `$color-teal` is green (`#46D369`); legacy `--clr-gold` / `glow-gold` names still produce red, not gold
- Auth selects cloud when `VITE_CLOUD_API_URL` is configured; watchlist CRUD uses cloud only for cloud users, otherwise local SQLite. This is backend selection, not offline synchronization
- See `src/lib/api/tmdb.ts` and `src-tauri/src/api/tmdb.rs` as canonical patterns
