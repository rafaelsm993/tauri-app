# Changelog

All notable changes to TauriFlix are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Six media categories: movies/TV (TMDB), anime/manga (AniList GraphQL), games (RAWG), and books (iTunes)
- Shared `MediaItem`/`MediaDetail` mappings across providers
- Search, genre filtering, and per-genre discovery carousels
- Media details at `/media/[type]/[id]`, with cast, trailers, and provider-specific metadata/screenshots when available
- Infinite scroll with IntersectionObserver
- Netflix-style MediaCard with poster, rating, hover overlay
- CSS-animated floating background shapes, radial glows, and vignette
- Netflix-style SCSS/CSS design tokens, with SCSS variables and mixins auto-injected by Vite
- Svelte 5 runes and class-based application stores

### Removed
- Local account system (register / login / profile switching) and its SQLite `users` table
- Watchlist feature, including the `watchlist` table, the `/watchlist` route, and the `WatchlistButton` component
- Optional cloud backend integration (`VITE_CLOUD_API_URL`, `src/lib/api/cloud.ts`)
- The unused `greet` Tauri command
- The `rusqlite` dependency — the backend is now a stateless API proxy

### Known issues
- See [Project review — findings and backlog](docs/PROJECT_REVIEW.md#11-findings-and-backlog) for current security, persistence, UI, and build-tooling limitations.

## [0.1.0] - unreleased
- Initial project scaffold (Tauri 2 + SvelteKit + Rust)
