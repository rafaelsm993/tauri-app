# TauriFlix — Config and Stack

> Manifests, config files, dependencies and system requirements.

## 1. package.json

`"type": "module"`: all `.js` files use ES modules.

### Scripts

| Script | What it does |
| --- | --- |
| `dev` | Vite dev server on port 1420 with HMR |
| `build` | Static SPA into `build/` |
| `preview` | Serve the production build locally |
| `check` | `svelte-kit sync` + `svelte-check` (type-checks `.svelte` and `.ts`) |
| `check:watch` | Same as `check`, in watch mode |
| `tauri` | Tauri CLI proxy: `npm run tauri dev`, `npm run tauri build` |

There is no `test` script. Structural tests run directly with `node --test scripts/<name>.test.mjs` from the repo root.

## 2. Runtime dependencies

| Package | Purpose |
| --- | --- |
| `@tauri-apps/api` ^2 | `invoke()` to Rust commands |
| `@tauri-apps/plugin-opener` ^2 | Opens URLs in the system browser (plugin is registered; no frontend call site yet) |

## 3. Dev dependencies

| Package | Version | Role |
| --- | --- | --- |
| `vite` | ^6.0.3 | Bundler, dev server, HMR |
| `@sveltejs/kit` | ^2.9.0 | Routing, `$app/*`, build |
| `@sveltejs/vite-plugin-svelte` | ^5.0.0 | Compiles `.svelte`; `vitePreprocess()` for TS/SCSS |
| `@sveltejs/adapter-static` | ^3.0.6 | Static output to `build/` |
| `@tauri-apps/cli` | ^2 | `tauri` command |
| `svelte` | ^5.0.0 | Compiler |
| `typescript` | ~5.6.2 | Types |
| `sass` | ^1.97.3 | SCSS |
| `svelte-check` | ^4.0.0 | `npm run check` |

## 4. Config files

- `svelte.config.js` does two things: it enables `vitePreprocess()` and sets `adapter-static({ fallback: "app.html" })`.
- `vite.config.js`:
  - `plugins: [sveltekit()]`
  - `css.preprocessorOptions.scss`: `loadPaths: ["src/lib/styles"]` plus `additionalData: "@use 'variables' as *;"`. This auto-injects the SCSS variables and mixins into every component.
  - `server`: port 1420, `strictPort`, optional `TAURI_DEV_HOST` for HMR on 1421, and `src-tauri/**` excluded from watching.
- `src/routes/+layout.ts` sets `export const ssr = false`.
- `src-tauri/tauri.conf.json`:
  - dev URL `http://localhost:1420`; `frontendDist: "../build"`
  - one 800×600 window with devtools on
  - `csp: null`
  - bundles all targets
- `src-tauri/capabilities/default.json` grants `core:default` and `opener:default` to the `main` window.
- `src-tauri/build.rs`:
  - reads `../.env` and emits every `KEY=value` line as `cargo:rustc-env`
  - reruns when `.env` changes, then calls `tauri_build::build()`

## 5. Svelte 5 runes

| Rune | Purpose | Example |
| --- | --- | --- |
| `$state(v)` | Reactive state | `let page = $state(1)` |
| `$derived(expr)` | Computed value | `const carouselMode = $derived(!isSearch && activeGenre === null)` |
| `$effect(() => {})` | Side effect, re-runs on dependency change | observer re-attach, detail fetch |
| `$props()` | Component props | `let { item, onclick } = $props<…>()` |

This project keeps its shared state in `.svelte.ts` class stores built with runes, instead of `svelte/store`. That is a project convention; Svelte itself supports both.

## 6. Rust / Cargo (`src-tauri/Cargo.toml`)

| Crate | Version | Features | Purpose |
| --- | --- | --- | --- |
| `tauri` | 2 | — | App framework, IPC, windows |
| `tauri-plugin-opener` | 2 | — | Open URLs/files |
| `serde` | 1 | `derive` | Serialization |
| `serde_json` | 1 | — | `Value` return type |
| `reqwest` | 0.12 | `json`, `rustls-tls` (no default features) | HTTP to providers |
| `tokio` | 1 | `full` | Async runtime, `join!` |
| `tauri-build` (build) | 2 | — | Codegen |

Build profiles (the reasoning is in [BUILD_AND_RUN.md](../BUILD_AND_RUN.md)):

- dev: `debug = 1`, 256 codegen units, incremental
- dependencies in dev (`[profile.dev.package."*"]`): `opt-level = 3`
- release: thin LTO, 1 codegen unit, `panic = "abort"`, stripped

## 7. External APIs and `.env`

| API | Base | Auth | Used for |
| --- | --- | --- | --- |
| TMDB v3 | `api.themoviedb.org/3` | `TMDB_API_KEY` | Movies, TV |
| AniList | `graphql.anilist.co` | none | Anime, manga |
| RAWG | `api.rawg.io/api` | `RAWG_API_KEY` | Games |
| iTunes | `itunes.apple.com` | none | Books |

Repo-root `.env` (gitignored; template: `.env.example`):

```env
TMDB_API_KEY=...
RAWG_API_KEY=...
```

Both keys must be present at compile time, because `env!()` fails the build otherwise. A runtime environment variable with the same name overrides the embedded value.

## 8. System requirements

- Node.js ≥ 20 (Windows side currently v22)
- Rust stable via rustup
- **Windows laptop (WSL → Windows):** VS Build Tools with the C++ workload, the MSVC Rust target, and the WebView2 runtime. Details and `scripts/verify.ps1` are in [BUILD_AND_RUN.md](../BUILD_AND_RUN.md).
- **Linux native:**
  - Ubuntu: `libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev pkg-config`
  - Arch: `rustup webkit2gtk-4.1 libsoup3 base-devel openssl librsvg`. Setup and troubleshooting: [BUILD_AND_RUN.md](../BUILD_AND_RUN.md).
- See also the official [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## How it connects

```
npm run tauri dev
└─► @tauri-apps/cli
      ├─► vite dev (:1420)           → SvelteKit SPA
      └─► cargo build → Tauri window → Rust commands
              └── reqwest → TMDB / AniList / RAWG / iTunes
```
