# TauriFlix — Project Guidelines

## Architecture

Tauri 2 desktop app: SvelteKit SPA (frontend) + Rust (backend), bridged via Tauri IPC `invoke()`.

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
- **Rust commands**: `async fn` returning `Result<Value, String>`, registered in `lib.rs` via `generate_handler![]`
- **API keys**: Loaded from `.env` at compile time via `build.rs` — never hardcode

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
- New Rust commands must be added to both `api/mod.rs` AND `lib.rs`
- Component styles use SCSS design tokens directly (`$color-primary`, `$spacing-md`, `@include glass`)
- See `src/lib/api/tmdb.ts` and `src-tauri/src/api/tmdb.rs` as canonical patterns
