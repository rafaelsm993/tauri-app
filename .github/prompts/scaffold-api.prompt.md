---
description: "Scaffold a new API integration for TauriFlix — creates Rust backend commands, registers them, adds TypeScript frontend service, and extends shared types."
agent: "tauriflix"
model: "Claude Opus 4.6 (copilot)"
argument-hint: "Provider name and API details (e.g., 'Spotify API for music search and album details')"
tools: [read, edit, search, execute, todo]
---

Scaffold a full-stack API integration for TauriFlix. Follow the exact patterns from the existing TMDB integration.

## Steps

1. **Read existing patterns first**: Study [tmdb.rs](../../../src-tauri/src/api/tmdb.rs), [tmdb.ts](../../../src/lib/api/tmdb.ts), [media.ts](../../../src/lib/types/media.ts), [mod.rs](../../../src-tauri/src/api/mod.rs), and [lib.rs](../../../src-tauri/src/lib.rs) to match conventions exactly.

2. **Rust backend** (`src-tauri/src/api/{provider}.rs`):
   - `use reqwest::Client;` and `use serde_json::Value;`
   - Each command: `#[tauri::command] pub async fn ... -> Result<Value, String>`
   - Error handling: `.map_err(|e: reqwest::Error| e.to_string())?`
   - At minimum: one search command and one details command

3. **Register Rust module**: Add `pub mod {provider};` to `src-tauri/src/api/mod.rs`

4. **Register commands**: Add all new commands to `tauri::generate_handler![]` in `src-tauri/src/lib.rs`

5. **Extend types if needed**: Update `src/lib/types/media.ts` — prefer mapping to existing `MediaItem`/`MediaDetail` interfaces. Only add new interfaces if the provider has fundamentally different data shapes.

6. **Frontend service** (`src/lib/api/{provider}.ts`):
   - `import { invoke } from '@tauri-apps/api/core';`
   - Private `map()` function converting raw JSON → `MediaItem`
   - Private `mapPage()` function converting raw response → `PaginatedResult<MediaItem>`
   - Export a named const object (e.g., `SpotifyAPI`) with typed methods

7. **Validate**: Run `npm run check` and check for errors.

Provide a summary of all files created/modified when done.
