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
- Local SQLite accounts and per-user watchlists with `want` / `watching` / `watched` status
- Optional cloud auth/watchlist backend selected via `VITE_CLOUD_API_URL`, with access/refresh tokens and one retry after a successful token refresh (not offline synchronization)
- User session persistence in `localStorage`
- Infinite scroll with IntersectionObserver
- Netflix-style MediaCard with poster, rating, hover overlay
- CSS-animated floating background shapes, radial glows, and vignette
- Netflix-style SCSS/CSS design tokens, with SCSS variables and mixins auto-injected by Vite
- Svelte 5 runes and class-based application stores

### Known issues
- See [Project review — findings and backlog](docs/PROJECT_REVIEW.md#11-findings-and-backlog) for current security, persistence, UI, and build-tooling limitations.

## [0.1.0] - unreleased
- Initial project scaffold (Tauri 2 + SvelteKit + Rust)
