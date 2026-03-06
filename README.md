# Tauri + SvelteKit + TypeScript

This template should help get you started developing with Tauri, SvelteKit and TypeScript in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

# TauriFlix

A cross-platform media tracker built with **Tauri 2**, **SvelteKit**, and **Rust**.

Tracks movies, TV series, anime, and books via TMDB, Jikan, and OpenLibrary.

## Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | SvelteKit + Svelte 5 runes          |
| Styling   | SCSS + CSS custom properties        |
| Backend   | Rust (Tauri 2 commands)             |
| APIs      | TMDB, Jikan, OpenLibrary            |

## Getting Started

```bash
# Prerequisites: Node 20+, Rust stable, system WebView

git clone https://github.com/your-org/tauriflix
cd tauriflix
npm install
cp .env.example .env   # add your TMDB_API_KEY
npm run tauri dev
```

## Building

```bash
npm run tauri build    # produces installers in src-tauri/target/release/bundle/
```

## Branch Model

| Branch        | Purpose                              |
|---------------|--------------------------------------|
| `main`        | Stable releases only (tagged)        |
| `release/x.y` | Release candidate — fixes only       |
| `dev`         | Integration — all features land here |
| `feat/*`      | Feature branches (from dev)          |
| `fix/*`       | Bug fix branches (from dev)          |

See [CONTRIBUTING.md](CONTRIBUTING.md) for full workflow.

## Environment Variables

| Variable        | Required | Description                  |
|-----------------|----------|------------------------------|
| `TMDB_API_KEY`  | Yes      | From themoviedb.org/settings |

## License

MIT
