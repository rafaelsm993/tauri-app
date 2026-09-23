# TauriFlix — Architecture

> Tauri 2 desktop app: a SvelteKit SPA that calls a stateless Rust backend, which forwards requests to four public media APIs.

## Overview

TauriFlix lets you browse movies, TV series, anime, manga, books and games. It has two screens: **Home** (discovery and search) and **Detail**. There are no accounts, no watchlist and no local database. The Rust backend only forwards HTTP requests to TMDB, AniList, RAWG and iTunes and returns the JSON.

```
┌──────────────────────────────────────────────────────────┐
│                 Tauri Window (WebView)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │            SvelteKit SPA (TypeScript)              │  │
│  │  Routes ──→ Components ──→ src/lib/api/*.ts        │  │
│  │                                  │ invoke('cmd')   │  │
│  └──────────────────────────────────┼─────────────────┘  │
│                                     │ Tauri IPC          │
│  ┌──────────────────────────────────┼─────────────────┐  │
│  │          Rust backend (Tauri 2)  ▼                 │  │
│  │   #[tauri::command] handlers in src-tauri/src/api/ │  │
│  │     reqwest → TMDB · AniList · RAWG · iTunes       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Layers

### Frontend — SvelteKit SPA

- SvelteKit with `adapter-static`: no SSR and no server.
- TypeScript with Svelte 5 runes.
- SCSS variables and mixins are injected automatically, alongside CSS custom properties in `global.css`.
- Data comes only from Tauri `invoke()` (`@tauri-apps/api/core`). The app never calls `fetch()`.
- Each `src/lib/api/<provider>.ts` maps raw provider JSON into the shared `MediaItem` / `MediaDetail` types (`src/lib/types/media.ts`).

### Backend — Rust / Tauri 2

- Tauri 2 with `tauri-plugin-opener`.
- `reqwest` 0.12 with `rustls-tls` (no OpenSSL) runs on Tokio.
- Commands are `async fn` returning `Result<serde_json::Value, String>`. They return the provider's raw JSON, and the frontend does all the mapping.
- No managed state and no database.
- API keys: `TMDB_API_KEY` and `RAWG_API_KEY` are read from `.env` at compile time by `build.rs`. At runtime, `std::env::var` overrides them.
- 19 commands are registered in `src-tauri/src/lib.rs`: TMDB 8, AniList 5, iTunes 2, RAWG 4. See [API Reference](API%20Reference.md).

## SPA configuration

Tauri has no Node server, so the frontend is a static bundle loaded from disk.

1. `svelte.config.js` uses `adapter-static({ fallback: "app.html" })`, so every route resolves to the same HTML file.
2. `src/routes/+layout.ts` sets `export const ssr = false`.
3. `vite.config.js` runs the dev server on port 1420 (`strictPort`), ignores `src-tauri/` in the watcher, and auto-injects `variables.scss`.

### Routes

```
/                    → Home (discover / search across 6 categories)
/media/[type]/[id]   → Detail (type = movie|tv|anime|manga|book|game)
```

Navigation happens on the client via `goto()` from `$app/navigation`.

## Data flow

### Search (example: TMDB movies)

```
SearchBar submit → onSearch(q) in +page.svelte
  → fetchPage('movie', q, 1, null)
    → TmdbAPI.searchMovies(q, 1)
      → invoke('tmdb_search_movies', { query, page })
        → Rust: GET https://api.themoviedb.org/3/search/movie?api_key=…&language=pt-BR
      ← raw JSON page
    → mapPage(raw, mapMovie) → PaginatedResult<MediaItem>
  → items = res.results   ($state → grid of MediaCard)
```

### Detail

```
MediaCard click → goto(`/media/${type}/${encodeURIComponent(id)}`)
  → detail page $effect reads $page.params → fetchDetail(type, id)
    → e.g. TmdbAPI.movieDetails(id) → invoke('tmdb_movie_details', { id })
      → Rust: GET /movie/{id}?append_to_response=credits,videos
    → mapDetail(raw, 'movie') → MediaDetail
  → hero, poster, meta, genres, overview, trailer, screenshots, cast
```

### Infinite scroll (grid mode only)

An `IntersectionObserver` with `rootMargin: "300px"` watches a sentinel `<div>`. When the sentinel comes into view, `loadMore()` fetches `page + 1` and appends the results. An `$effect` re-attaches the observer while `hasMore` is true.

## State

State is kept inside components with `$state` / `$derived`. There is one shared store:

| Store | File | Used fields |
| --- | --- | --- |
| `ui` | `src/lib/stores/ui.svelte.ts` | `detailMode` (set to true by the detail page, reset on destroy); `lastClick` (read by `AppBackground` for the bubble pulse) |

`activeHue`, `intensity`, `triggerClickPulse()` and `setHoverHue()` still exist in the store but have no callers. They are leftovers from the removed Canvas background.

## Background system

| Layer | z-index | Source |
| --- | --- | --- |
| Bubbles + radial glows (`.bg-layer`) | 0 | `AppBackground.svelte` (CSS keyframes, 20 `<li>`) |
| Vignette | 1 (inside `.bg-layer`) | `AppBackground.svelte` |
| Page content | 1 | `.app-content` in `+layout.svelte` |
| Film grain | 4 | `body::before` in `global.css` (`pointer-events: none`) |

## Build pipeline

- Dev: `npm run tauri dev` starts Vite on `:1420` and opens the WebView against it. Changes to `src-tauri/` trigger a Rust rebuild.
- Prod: `npm run tauri build` runs `npm run build` (static SPA into `build/`), then compiles the Rust binary with the frontend embedded, then bundles.
- This machine edits in WSL and builds on Windows: see [BUILD_AND_RUN.md](../BUILD_AND_RUN.md) (`./scripts/wdev.sh`, `./scripts/wdev.sh build`).

## Security notes

- CSP is `null` in `tauri.conf.json` for every build. It needs a decision before release.
- Capabilities: `core:default` + `opener:default` (`src-tauri/capabilities/default.json`).
- API keys stay out of source (`.env` is gitignored), but they are embedded in the compiled binary. Anyone who inspects the binary can recover them, so treat them as public.
