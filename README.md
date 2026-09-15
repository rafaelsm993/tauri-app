# TauriFlix

A cross-platform media tracker built with **Tauri 2**, **SvelteKit**, and **Rust**.

Tracks movies, TV series, anime, manga, books, and games via TMDB, AniList, RAWG, and iTunes, with local accounts and per-user watchlists or an optional cloud backend.

See [Project review and feature overview](docs/PROJECT_REVIEW.md) for the implementation inventory, validation results, and known limitations.

## Stack

| Layer    | Technology                   |
| -------- | ---------------------------- |
| Frontend | SvelteKit + Svelte 5 runes   |
| Styling  | SCSS + CSS custom properties |
| Backend  | Rust (Tauri 2 commands)      |
| APIs     | TMDB, AniList, RAWG, iTunes |

## Getting Started

```bash
# Prerequisites: Node 20+, Rust stable, system WebView

git clone https://github.com/rafaelsm993/tauri-app
cd tauri-app
npm install
# Configure the environment variables below before compiling
npm run tauri dev
```

## Building

```bash
npm run tauri build    # produces installers in src-tauri/target/release/bundle/
```

## Branch Model

| Branch        | Purpose                              |
| ------------- | ------------------------------------ |
| `main`        | Stable releases only (tagged)        |
| `release/x.y` | Release candidate — fixes only       |
| `dev`         | Integration — all features land here |
| `feat/*`      | Feature branches (from dev)          |
| `fix/*`       | Bug fix branches (from dev)          |

See [CONTRIBUTING.md](CONTRIBUTING.md) for full workflow.

## Environment Variables

| Variable       | Required | Description                  |
| -------------- | -------- | ---------------------------- |
| `TMDB_API_KEY` | Yes      | Must be defined at Rust compile time; valid key needed for movies/TV |
| `RAWG_API_KEY` | Yes      | Must be defined at Rust compile time; valid key needed for games |
| `VITE_CLOUD_API_URL` | No | Base URL of the optional auth/watchlist server, read by Vite at dev/build time |

Set these in a project-root `.env` before starting development or building. Rust keys are embedded at compile time and can be overridden by runtime environment variables. AniList and iTunes require no API key.

Without a cloud URL, accounts and watchlists use local SQLite. When configured, login/registration use the cloud HTTP client; cloud-user watchlist operations use that backend too. Media requests still go through Rust. This selects a persistence backend; it does not implement offline synchronization or migrate local data to the cloud.

## License

MIT
