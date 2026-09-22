# Strip auth + watchlist down to Home and Detail

Status: PLAN ONLY — do not execute in the turn that produced this file.

## Goal

Reduce TauriFlix to two working screens — the Home list fed by the media APIs and the Detail page for a selected item — by deleting all account, login, and watchlist code from both the Svelte frontend and the Rust backend.

## Current context (verified by inspection, 2026-09-21)

- Branch: `chore/wsl-windows-build-pipeline`. Working tree clean except the untracked plan file `.hermes/plans/2026-09-21_172803-tauriflix-wsl-windows-build-and-run.md`.
- **There is no MySQL anywhere in this repo.** `grep -rni mysql` over the tree (excluding `node_modules`, `target`, `.git`) returns zero files. The user's "mysql" refers to two real things:
  1. **Local SQLite** via `rusqlite` (`bundled` feature) — `src-tauri/src/api/auth.rs` and `src-tauri/src/api/watchlist.rs`, database file `src-tauri/tauriflix.db`.
  2. **An optional remote cloud API** — `src/lib/api/cloud.ts`, enabled only when `VITE_CLOUD_API_URL` is set in `.env` (it currently *is* set).
  Both are removed by this plan.
- Routes today: `src/routes/+page.svelte` (home), `src/routes/media/[type]/[id]/+page.svelte` (detail), `src/routes/auth/+page.svelte` (login/register), `src/routes/watchlist/+page.svelte` (my list).
- `src/routes/+layout.svelte` renders `UserButton` in a fixed top-right nav.
- Rust `src-tauri/src/lib.rs` registers 29 commands: `greet`, TMDB (8), AniList (5), iTunes (2), RAWG (4), auth (4), watchlist (5). It also builds `DbConn::new("tauriflix.db")` and `.manage(db)`.
- `DbConn` is **defined in** `src-tauri/src/api/watchlist.rs` and **imported by** `src-tauri/src/api/auth.rs` (`use super::watchlist::DbConn;`). Deleting watchlist without deleting auth will not compile.
- `greet` is registered in Rust but **never invoked from the frontend** (`grep -rn greet src` → no matches). It is dead code and goes too.
- `src/lib/types/media.ts` lines 1-9 hold the `User` interface and a `WatchlistStatus` re-export that imports from `../api/watchlist`. That import breaks the moment `watchlist.ts` is deleted.
- `WatchlistButton` is used in exactly two places: `src/lib/components/media/MediaCard.svelte` (import line 9, markup ~line 107-123, style block `.card__wl-action`) and `src/routes/media/[type]/[id]/+page.svelte` (import line 11, markup ~line 200-202).
- Tracked binary DBs: `src-tauri/tauriflix.db` and `.allai/workspace.db`.
- No test runner is configured in `package.json`. The only existing test is `scripts/verify-toolchain.test.mjs`, run with Windows `node --test`. This plan adds a second test in the same style.

## Committing

**The user commits manually in this repo.** Do not run `git commit`, `git add`, `git push`, or `git reset`. Where this plan says "checkpoint", it means: stop, report what changed, and let the user commit. Nothing else.

## Architecture / approach

Delete rather than feature-flag: auth, cloud sync, and the watchlist are removed wholesale from both stacks, taking `rusqlite` and the SQLite state object with them, so the Rust backend becomes a stateless set of HTTP proxy commands over TMDB/AniList/iTunes/RAWG. The frontend keeps exactly two routes and loses the user/watchlist stores, the `UserButton` nav, and every `WatchlistButton` mount point. A structural test (`scripts/no-auth.test.mjs`) asserts the absence of the deleted symbols so the cleanup is verifiable and cannot silently regress.

## Order of work

Frontend first (Svelte fails loudly and fast via `npm run check`), then Rust, then dependency and asset cleanup, then docs. Each phase ends at a checkpoint.

## Phase 0 — Baseline

### Task 0.1 — Confirm a clean starting point

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
git status --short
git branch --show-current
```

Expected: branch `chore/wsl-windows-build-pipeline`; the only line of output is
`?? .hermes/plans/2026-09-21_172803-tauriflix-wsl-windows-build-and-run.md`
(plus this new plan file). If other files are modified, stop and ask the user.

### Task 0.2 — Record the green baseline

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
npm run check 2>&1 | tail -3
```

Expected: `svelte-check found 0 errors and 0 warnings`.

## Phase 1 — The failing test (RED)

### Task 1.1 — Write `scripts/no-auth.test.mjs`

Create the file with exactly this content:

```js
// scripts/no-auth.test.mjs
// Structural guard: the app must contain only Home + Detail, with no
// account, login, or watchlist code in either stack.
// Run from the repo root:  node --test scripts/no-auth.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const DELETED_FILES = [
  "src/routes/auth/+page.svelte",
  "src/routes/watchlist/+page.svelte",
  "src/lib/api/auth.ts",
  "src/lib/api/cloud.ts",
  "src/lib/api/watchlist.ts",
  "src/lib/stores/user.svelte.ts",
  "src/lib/stores/watchlist.svelte.ts",
  "src/lib/components/ui/UserButton.svelte",
  "src/lib/components/ui/WatchlistButton.svelte",
  "src-tauri/src/api/auth.rs",
  "src-tauri/src/api/watchlist.rs",
  "src-tauri/tauriflix.db",
];

test("deleted files are gone", () => {
  for (const f of DELETED_FILES) {
    assert.equal(existsSync(join(root, f)), false, `${f} should be deleted`);
  }
});

test("only home and detail routes remain", () => {
  const routes = walk("src/routes").sort();
  assert.deepEqual(routes, [
    "src/routes/+layout.svelte",
    "src/routes/+layout.ts",
    "src/routes/+page.svelte",
    "src/routes/media/[type]/[id]/+page.svelte",
  ]);
});

test("no auth or watchlist symbols in frontend source", () => {
  const banned = [
    "userStore", "AuthAPI", "CloudAPI", "WatchlistAPI",
    "watchlistStore", "UserButton", "WatchlistButton",
    "VITE_CLOUD_API_URL",
  ];
  for (const file of walk("src")) {
    const body = read(file);
    for (const symbol of banned) {
      assert.ok(
        !body.includes(symbol),
        `${file} still references ${symbol}`,
      );
    }
  }
});

test("rust registers only media proxy commands", () => {
  const lib = read("src-tauri/src/lib.rs");
  for (const symbol of ["auth_", "watchlist", "DbConn", "greet", "rusqlite"]) {
    assert.ok(!lib.includes(symbol), `lib.rs still references ${symbol}`);
  }
});

test("rusqlite dependency is removed", () => {
  assert.ok(!read("src-tauri/Cargo.toml").includes("rusqlite"));
});

test("api module registry lists only providers", () => {
  const mod = read("src-tauri/src/api/mod.rs").trim().split("\n").sort();
  assert.deepEqual(mod, [
    "pub mod anilist;",
    "pub mod itunes;",
    "pub mod rawg;",
    "pub mod tmdb;",
  ]);
});

test("User and WatchlistStatus types are gone from media.ts", () => {
  const types = read("src/lib/types/media.ts");
  assert.ok(!types.includes("interface User"));
  assert.ok(!types.includes("WatchlistStatus"));
});
```

### Task 1.2 — Run it and confirm it FAILS

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
node --test scripts/no-auth.test.mjs 2>&1 | tail -6
```

Expected: `# fail 7` (all seven tests fail — nothing has been deleted yet).
If any test passes at this point, the test is wrong; fix it before continuing.

**Checkpoint** — report to the user: one new file `scripts/no-auth.test.mjs`, 7/7 failing as designed.

## Phase 2 — Frontend deletions (GREEN, part 1)

### Task 2.1 — Delete the two dead routes

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
rm -rf src/routes/auth src/routes/watchlist
ls src/routes
```

Expected output: `+layout.svelte  +layout.ts  +page.svelte  media`

### Task 2.2 — Delete the account/watchlist library files

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
rm -f src/lib/api/auth.ts src/lib/api/cloud.ts src/lib/api/watchlist.ts \
      src/lib/stores/user.svelte.ts src/lib/stores/watchlist.svelte.ts \
      src/lib/components/ui/UserButton.svelte \
      src/lib/components/ui/WatchlistButton.svelte
ls src/lib/api src/lib/stores src/lib/components/ui
```

Expected: `src/lib/api` → `anilist.ts  itunes.ts  rawg.ts  tmdb.ts`; `src/lib/stores` → `ui.svelte.ts`; `src/lib/components/ui` → `AppBackground.svelte  CategoryTabs.svelte  GenreCarousel.svelte  GenreFilter.svelte  SearchBar.svelte`.

### Task 2.3 — Rewrite `src/routes/+layout.svelte`

The nav existed only to hold `UserButton`, so the whole `<nav>` and its style block go. Replace the entire file with:

```svelte
<script lang="ts">
  import "$lib/styles/global.css";
  import AppBackground from "$lib/components/ui/AppBackground.svelte";
  import type { Snippet } from "svelte";

  let { children } = $props<{ children: Snippet }>();
</script>

<AppBackground />
<div class="app-content">
  {@render children()}
</div>
```

Note: the file currently uses CRLF line endings. Preserve whatever the editor does by default; SvelteKit does not care.

### Task 2.4 — Strip the watchlist types from `src/lib/types/media.ts`

Delete lines 1-9 — the `User` interface and the `WatchlistStatus` re-export (the latter imports from the now-deleted `../api/watchlist`). Remove exactly this block:

```ts
// ── User type ─────────────────────────────────────────────
export interface User {
  id: number | string;
  name: string;
  email: string;
}
// Re-export WatchlistStatus for unified import
import type { WatchlistStatus as _WatchlistStatus } from '../api/watchlist';
export type WatchlistStatus = _WatchlistStatus;
```

The file must now begin with the `// ====...` banner comment (`TauriFlix — Core Media Types`).

Verify:

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
head -3 src/lib/types/media.ts
```

Expected: the first line is `// ================================================================`.

### Task 2.5 — Remove the WatchlistButton from `src/lib/components/media/MediaCard.svelte`

Three edits in this one file:

1. Delete the import at line 9:
   ```svelte
   import WatchlistButton from "$lib/components/ui/WatchlistButton.svelte";
   ```
2. Delete the whole floating-action block in the markup (the comment `<!-- WatchlistButton: floating action, shown on hover -->` through the `</div>` that closes `class="card__wl-action"`, including the `<WatchlistButton {item} compact />` line). This is roughly lines 107-123; delete from the comment down to and including the `</div>` immediately after the component tag.
3. Delete the now-orphaned style rule at the top of the `<style lang="scss">` block:
   ```scss
   // ── WatchlistButton container ────────────────────────────
   .card__wl-action {
     position: absolute;
     bottom: $spacing-sm;
     right: $spacing-sm;
     z-index: 10;
     opacity: 1;
     transition: opacity $dur-normal $ease-out-expo;
   }
   ```

Verify:

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
grep -c "Watchlist\|card__wl-action" src/lib/components/media/MediaCard.svelte
```

Expected: `0`.

### Task 2.6 — Remove the WatchlistButton from the detail page

In `src/routes/media/[type]/[id]/+page.svelte`:

1. Delete the import (line 11): `import WatchlistButton from "$lib/components/ui/WatchlistButton.svelte";`
2. Delete this wrapper from the hero markup (~lines 200-202):
   ```svelte
   <div style="margin-top: 12px;">
     <WatchlistButton item={detail} />
   </div>
   ```

Verify:

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
grep -c "Watchlist" 'src/routes/media/[type]/[id]/+page.svelte'
```

Expected: `0`.

### Task 2.7 — Frontend gate

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
npm run check 2>&1 | tail -3
```

Expected: `svelte-check found 0 errors and 0 warnings`.
If it reports unresolved imports, a reference from Tasks 2.3-2.6 was missed — `grep -rn "userStore\|Watchlist\|CloudAPI" src` to find it.

**Checkpoint** — frontend is auth-free. Report; user commits.

## Phase 3 — Rust deletions (GREEN, part 2)

### Task 3.1 — Delete the two Rust modules

`auth.rs` depends on `DbConn` from `watchlist.rs`, so both go together.

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
rm -f src-tauri/src/api/auth.rs src-tauri/src/api/watchlist.rs
ls src-tauri/src/api
```

Expected: `anilist.rs  itunes.rs  mod.rs  rawg.rs  tmdb.rs`

### Task 3.2 — Rewrite `src-tauri/src/api/mod.rs`

Replace the whole file with:

```rust
pub mod anilist;
pub mod itunes;
pub mod rawg;
pub mod tmdb;
```

### Task 3.3 — Rewrite `src-tauri/src/lib.rs`

Drops `greet` (dead — never invoked from the frontend), the `DbConn` import, the `.manage(db)` state, and the 9 auth/watchlist command registrations. 29 commands become 19. Replace the whole file with:

```rust
pub mod api;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // ── TMDB (movies + series) ──
            api::tmdb::tmdb_discover_movies,
            api::tmdb::tmdb_search_movies,
            api::tmdb::tmdb_movie_details,
            api::tmdb::tmdb_genres_movies,
            api::tmdb::tmdb_discover_tv,
            api::tmdb::tmdb_search_tv,
            api::tmdb::tmdb_tv_details,
            api::tmdb::tmdb_genres_tv,
            // ── AniList / iTunes (anime, manga, books) ──
            api::anilist::anilist_search_anime,
            api::anilist::anilist_anime_details,
            api::anilist::anilist_search_manga,
            api::anilist::anilist_manga_details,
            api::anilist::anilist_genres,
            api::itunes::itunes_search,
            api::itunes::itunes_details,
            // ── RAWG (games) ──
            api::rawg::rawg_search,
            api::rawg::rawg_discover,
            api::rawg::rawg_details,
            api::rawg::rawg_genres
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Task 3.4 — Drop the `rusqlite` dependency

In `src-tauri/Cargo.toml`, delete this line (currently line 22):

```toml
rusqlite = { version = "0.39.0", features = ["bundled"] }
```

Leave the `[profile.dev]`, `[profile.dev.package."*"]`, and `[profile.release]` blocks untouched — they are the build-performance tuning from the previous work and are unrelated.

### Task 3.5 — Rust gate

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app/src-tauri
cargo.exe check --locked 2>&1 | tail -5
```

Expected: `Finished \`dev\` profile [optimized + debuginfo] target(s)`, no `error[E...]` lines.

Note: `cargo.exe`, not `cargo` — there is no Linux Rust toolchain in this WSL instance.

If `--locked` fails because `Cargo.lock` no longer matches after removing `rusqlite`, run `cargo.exe check` once (no `--locked`) to let the lockfile update, then re-run with `--locked`.

**Checkpoint** — backend compiles with 19 commands, no SQLite. Report; user commits.

## Phase 4 — Asset and config cleanup

### Task 4.1 — Untrack the SQLite database

The `.db` file is a tracked binary that no code opens any more.

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
git rm --cached src-tauri/tauriflix.db
rm -f src-tauri/tauriflix.db
```

Note: `git rm --cached` stages a deletion. This is the single exception to the no-git rule, and it is unavoidable for untracking. Tell the user it is staged; do **not** commit it.

### Task 4.2 — Ignore future database files

Append to `.gitignore`:

```
# Local SQLite databases (no longer used by the app)
*.db
```

Verify:

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
git check-ignore -v src-tauri/tauriflix.db
```

Expected: a line naming `.gitignore` and the `*.db` pattern.

### Task 4.3 — Remove the cloud API key from `.env`

Delete the `VITE_CLOUD_API_URL=...` line from `.env`. Keep `TMDB_API_KEY` and `RAWG_API_KEY` — `src-tauri/build.rs` still needs both.

Verify (redacted, never print secrets):

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
sed 's/=.*/=<redacted>/' .env
```

Expected exactly two lines: `TMDB_API_KEY=<redacted>` and `RAWG_API_KEY=<redacted>`.

## Phase 5 — Full validation (GREEN)

### Task 5.1 — The structural test must now pass

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
node --test scripts/no-auth.test.mjs 2>&1 | tail -6
```

Expected: `# pass 7` and `# fail 0`.
Any failure names the exact file and symbol still present — go fix that file.

### Task 5.2 — Type check

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
npm run check 2>&1 | tail -3
```

Expected: `svelte-check found 0 errors and 0 warnings`.

### Task 5.3 — Frontend build

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
npm run build 2>&1 | tail -5
ls build/app.html
```

Expected: `✓ built in ...` and `build/app.html` listed.

### Task 5.4 — Toolchain test still passes

Confirms Phase 3/4 did not disturb the Windows build pipeline.

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
powershell.exe -NoProfile -ExecutionPolicy Bypass \
  -File 'C:\Users\rafael.moraes\Code\tauri-app\scripts\verify.ps1' 2>&1 | tail -5
```

Expected: `# pass 8`, `# fail 0`.

### Task 5.5 — Run the app and confirm behaviour by eye

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
./scripts/wdev.sh
```

Manual checks, all required:
1. The window opens and the home grid populates with posters (proves the API keys still reach the binary).
2. There is **no** avatar/account button in the top-right corner.
3. Hovering a card shows **no** "Minha Lista" button.
4. Clicking a card opens the detail page; the hero shows the title and a "← Voltar" button, and **no** watchlist control.
5. "← Voltar" returns to the home grid.
6. Manually navigating to `http://localhost:1420/auth` shows the SvelteKit 404 fallback, not a login form.

If the grid is empty, the API keys did not reach the binary: `touch .env` and restart `wdev.sh`.

Stop the dev server with Ctrl-C when the checks pass.

**Checkpoint** — full cleanup verified. Report; user commits.

## Phase 6 — Documentation

### Task 6.1 — Update `README.md`

Remove any feature bullets mentioning accounts, login, registration, watchlist, or cloud sync. Find them first:

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
grep -n -i "auth\|login\|account\|watchlist\|cloud\|sqlite\|conta\|lista" README.md
```

Edit each hit so the README describes only: a home page listing media from TMDB / AniList / iTunes / RAWG, and a detail page per item.

### Task 6.2 — Add a CHANGELOG entry

Prepend under the `Unreleased` heading in `CHANGELOG.md`:

```markdown
### Removed

- Local account system (register / login / profile switching) and its SQLite
  `users` table.
- Watchlist feature, including the `watchlist` table, the `/watchlist` route,
  and the `WatchlistButton` component.
- Optional cloud backend integration (`VITE_CLOUD_API_URL`, `src/lib/api/cloud.ts`).
- The unused `greet` Tauri command.
- The `rusqlite` dependency — the backend is now a stateless API proxy.
```

### Task 6.3 — Flag `docs/PROJECT_REVIEW.md` as stale

That document describes 29 commands and the auth/watchlist features, and is now wrong. Insert directly below its top-level title:

```markdown
> **Stale as of the Home+Detail cleanup.** Sections covering authentication,
> the watchlist, cloud sync, and the SQLite layer describe code that has been
> removed. Command counts and file inventories predate that change.
```

Do not rewrite the review itself — it is a point-in-time snapshot tied to commit `eb3f1bf`.

### Task 6.4 — Update the project agent instructions

`.github/agents/tauriflix.agent.md` still documents `WatchlistStore` and the auth flow. Edit:
- In the "Stores" section, replace the `UIStore`, `WatchlistStore` example list with just `UIStore`.
- Remove any line referencing the watchlist or auth commands.

**Checkpoint** — docs match reality. Report; user commits.

## Tests / validation summary

| Gate | Command | Expected |
| --- | --- | --- |
| Structure | `node --test scripts/no-auth.test.mjs` | `# pass 7`, `# fail 0` |
| Types | `npm run check` | 0 errors, 0 warnings |
| Frontend build | `npm run build` | `✓ built`, `build/app.html` exists |
| Rust | `cd src-tauri && cargo.exe check --locked` | `Finished`, no errors |
| Toolchain | `powershell.exe -File scripts/verify.ps1` | `# pass 8` |
| Manual | `./scripts/wdev.sh` | 6 checks in Task 5.5 |

## Risks, tradeoffs, open questions

**The user said "mysql"; there is none.** This plan removes local SQLite plus the optional remote cloud API. If they actually have a separate MySQL-backed server project elsewhere, this plan does not touch it — confirm before starting.

**Deletion is irreversible without git.** All removed code lives in history on `chore/wsl-windows-build-pipeline`; recovering the watchlist later means `git show <sha>:src/lib/api/watchlist.ts`. Since the user commits manually, they should commit the current green state *before* Phase 2 so there is a restore point.

**`src-tauri/tauriflix.db` may hold real data.** It is a tracked binary with the user's accounts and saved items. Task 4.1 deletes the working copy. If they want the data, copy it somewhere outside the repo first.

**Removing `rusqlite` shrinks the binary but forces a rebuild.** `bundled` compiles SQLite from C source; dropping it means the next `cargo.exe build` recompiles the dependency graph — expect a one-off multi-minute build, not the usual 7.68s incremental.

**`greet` removal is safe but untested at runtime.** Static grep proves the frontend never calls it. If anything invokes `greet` dynamically via a computed command name, it would fail at runtime — nothing in this codebase does that.

**`.allai/workspace.db` is left alone.** It is tooling state, unrelated to the app, though it is also a tracked binary the user may want to untrack separately.

**Open question — the search bar.** `SearchBar`, `CategoryTabs`, `GenreFilter`, and `GenreCarousel` all stay, since "home page with the list from the APIs" implies browsing. If the user wants a barer home page, that is a separate follow-up.

**Open question — `AppBackground`.** Kept as-is. The `ui` store's `detailMode` flag is still used by the detail page, so the store survives the cleanup.

