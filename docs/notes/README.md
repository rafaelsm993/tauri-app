# Design notes

These notes were moved here from the author's Obsidian vault (`Programming/Tauri_APP/`) on 2026-09-22 and rewritten to match the current app: Home + Detail over TMDB, AniList, RAWG and iTunes, with a stateless Rust backend. The legacy notes about accounts, the watchlist, cloud sync and the companion server were not migrated. They remain in the vault's git history.

When a note disagrees with the code, the code is right. `node --test scripts/docs-notes.test.mjs` checks the notes against the code.

| Note | Covers |
| --- | --- |
| [Architecture](Architecture.md) | Topology, SPA setup, data flow, state, background layers, build |
| [API Reference](API%20Reference.md) | Every Tauri command, the frontend services, mapping rules, shared types, adding a provider |
| [Component Patterns](Component%20Patterns.md) | Props and behaviour of each UI component, root layout |
| [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md) | `+` file conventions, the Home and Detail routes |
| [Config and Stack](Config%20and%20Stack.md) | Scripts, dependencies, config files, `.env`, system requirements |
| [Design System](Design%20System.md) | Colour, type, spacing, motion, z-index tokens, SCSS mixins |

Related: [BUILD_AND_RUN.md](../BUILD_AND_RUN.md) (WSL → Windows build) and [PROJECT_REVIEW.md](../PROJECT_REVIEW.md). Note that PROJECT_REVIEW.md is a review from 2026-09-14, written before the auth/watchlist removal.
