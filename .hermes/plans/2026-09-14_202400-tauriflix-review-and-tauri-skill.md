# TauriFlix — Full Project Review + Tauri Skill Implementation Plan

> **Execution record — 2026-09-14:** This plan has been executed as a documentation-only review. The authoritative results, corrected assumptions, validation output and remaining issues are in [docs/PROJECT_REVIEW.md](../../docs/PROJECT_REVIEW.md). The body below is retained as the original planning record, not current architectural guidance or a script to rerun.
>
> Key corrections: 29 registered commands/28 frontend invocation names; no root auth guard; cloud backend selection is not offline sync; current background is CSS-only; current root YAML placement does not prove historical CI never ran. The proposed skill examples were replaced with validated examples. Windows `cargo.exe` supplied native validation; Clippy/rustfmt baseline failures and zero application tests are recorded in the review. Available delegation tools were used instead of the unavailable skill named below. No application source, database, vault or server changes were made.

> **Original planning instruction (superseded):** Use the `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Produce a verified, documented review of the current TauriFlix codebase (state, history, features, gaps) and author a reusable Hermes skill for Tauri 2 + SvelteKit(Svelte 5/TS) + Rust development.

**Architecture:** Two deliverables, no application behavior changes. (1) A review report committed at `docs/PROJECT_REVIEW.md` plus corrections to the stale docs that currently contradict the code (`README.md`, `CHANGELOG.md`, `.github/copilot-instructions.md`, `.github/agents/tauriflix.agent.md`). (2) A user-local Hermes skill `tauri-svelte-rust` created with `skill_manage`, grounded in official Tauri v2 / Svelte 5 docs and the real patterns found in this repo.

**Tech Stack:** Tauri 2 (Rust, reqwest, rusqlite, serde), SvelteKit 2 + Svelte 5 runes + TypeScript, Vite 6, SCSS (auto-injected), npm.

**Working directory for every command below:** `/mnt/c/Users/rafael.moraes/Code/tauri-app`

---

## Current Context (verified by inspection on 2026-09-14 — do not re-derive, but do re-verify with `git status`)

- **Git:** detached HEAD at `eb3f1bf` ("server connection logic"). Local branches: `main`, `dev`, `feat/media-detail-page`, `feat/multi-api-integration`. Remote `origin` = `https://github.com/rafaelsm993/tauri-app.git`. Working tree clean.
- **Size:** 82 tracked files, ~10.8k lines across tracked source/config/docs.
- **Rust backend** (`src-tauri/src/`): `lib.rs` (55 lines) registers 27 commands; modules `api/tmdb.rs` (217), `api/anilist.rs` (224), `api/rawg.rs` (157), `api/itunes.rs` (92), `api/auth.rs` (204), `api/watchlist.rs` (131). SQLite via `rusqlite` 0.39 bundled; DB file `tauriflix.db`.
- **Frontend** (`src/`): 4 routes (`/`, `/auth`, `/watchlist`, `/media/[type]/[id]`), 8 components, 3 stores (`ui`, `user`, `watchlist`), 7 API services (`tmdb`, `anilist`, `rawg`, `itunes`, `auth`, `watchlist`, `cloud`), shared types in `src/lib/types/media.ts`, styles in `src/lib/styles/{variables.scss,global.css}` (global.css is 1658 lines).
- **External docs** (NOT in this repo — Obsidian vault, read-only reference):
  `/mnt/c/Users/rafael.moraes/Code/obisidian-journal/Programming/Tauri_APP/` containing
  `API Reference.md` (385 lines), `Architecture.md` (344), `Cloud Server.md` (291),
  `Component Patterns.md` (295), `Config and Stack.md` (214), `Design System.md` (184),
  `Learning roadmap.md` (118), `Front-end/SvelteKit Special Pages.md` (185).
  These are the *most accurate* docs and describe an optional companion Axum+Postgres server repo at `~/Code/tauri-app_server`.
- **Known contradictions already found** (the review must record these, the doc fixes must resolve them):
  1. `README.md` still contains the stock "Tauri + SvelteKit + TypeScript" template header AND claims providers "TMDB, Jikan, OpenLibrary" — the code actually uses **TMDB, AniList (GraphQL), RAWG, iTunes**.
  2. `.github/agents/tauriflix.agent.md` and `.github/copilot-instructions.md` name Jikan/OpenLibrary and a **gold `#e8b84b` / bg `#080b10`** palette. `src/lib/styles/variables.scss` actually defines a **Netflix palette**: bg `#000000`, surface `#0a0a0a`, primary `#E50914`, accent `#B20710`, green `#46D369`, text `#F5F5F1` / `#B3B3B3` / `#808080`.
  3. `ci.yml` and `release.yml` sit at the **repo root**, not `.github/workflows/` — **CI has never run**.
  4. `ci.yml` calls `npm run lint`, which does not exist in `package.json`, and `cargo test` with zero tests in the repo.
  5. `src-tauri/src/api/auth.rs` hashes passwords with `std::collections::hash_map::DefaultHasher` (a non-cryptographic 64-bit SipHash) — not a password hash.
  6. `src-tauri/tauriflix.db` and `.allai/workspace.db` are **committed binaries** (`git ls-files` confirms).
  7. `src-tauri/tauri.conf.json` still ships `productName: "tauri-app"`, `identifier: "com.user.tauri-app"`, `csp: null`, `devtools: true`, window 800x600.
  8. `CHANGELOG.md` "Unreleased" lists only TMDB + infinite scroll; it predates anime/manga/games/books, auth, watchlist and cloud sync.
  9. Zero automated tests exist (no vitest, no `#[cfg(test)]`).

## Assumptions

- You may **read** the Obsidian folder but must **not** write to it.
- This plan changes **no application behavior**. Bug fixes (auth hashing, committed DBs, CI location) are only *recorded* as findings in Task 12; fixing them is out of scope and goes to the backlog section of the report.
- `npm install` has already been run (`node_modules/` exists). Rust toolchain is available.
- Work happens on a new branch off the current detached HEAD; nothing is pushed.

---

## Phase 0 — Setup

### Task 1: Create the working branch

**Objective:** Get off detached HEAD onto a named branch so commits are not lost.

**Commands:**

```bash
cd /mnt/c/Users/rafael.moraes/Code/tauri-app
git status --short          # expected: empty output (clean tree)
git switch -c docs/project-review-2026-09
git branch --show-current   # expected: docs/project-review-2026-09
```

**Completion criterion:** `git branch --show-current` prints `docs/project-review-2026-09`.

---

### Task 2: Record the baseline build/type-check state

**Objective:** Capture whether the project currently type-checks and compiles, so the report states facts, not guesses.

**Commands (run each, save the exact tail of output into your notes):**

```bash
npm run check 2>&1 | tail -20
cd src-tauri && cargo check 2>&1 | tail -20 ; cd ..
```

**Expected:** `npm run check` ends with a `svelte-check found N errors and M warnings` line — **record N and M verbatim**. `cargo check` ends with either `Finished ...` or a list of errors — **record verbatim**.

**Completion criterion:** You have two literal output lines written down; they will be pasted into `docs/PROJECT_REVIEW.md` §Build Health. Do not fix anything yet.

---

## Phase 1 — Read everything (no writing)

Each task below is "read and take structured notes". Notes accumulate in a scratch file `docs/.review-notes.md` which is **deleted in Task 13** (it is scaffolding, not a deliverable).

### Task 3: Read the in-repo documentation set

**Files to read (all of them, fully):**
- `README.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `.github/copilot-instructions.md`
- `.github/agents/tauriflix.agent.md`
- `.github/instructions/scss-autoinjection.instructions.md`
- `.github/prompts/scaffold-api.prompt.md`
- `ci.yml`, `release.yml`, `git-setup.sh`

**Note for each:** what it claims, and any claim contradicted by code (you already have 9 known contradictions above — confirm each and add new ones).

**Completion criterion:** `docs/.review-notes.md` has a `## Docs` section with one bullet per file and an explicit ✅/❌ accuracy verdict.

---

### Task 4: Read the Obsidian vault documentation

**Command:**

```bash
ls /mnt/c/Users/rafael.moraes/Code/obisidian-journal/Programming/Tauri_APP/
```

Read all 8 markdown files listed in Current Context. Do not modify them.

**Note:** the cloud-server contract (endpoints, schema), the design-system tokens, component prop tables, and the learning roadmap's completion checkmarks.

**Completion criterion:** `docs/.review-notes.md` has an `## Obsidian docs` section summarizing each file in ≤4 bullets, plus a list of facts present there but missing from in-repo docs.

---

### Task 5: Read the Rust backend

**Files:** `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/api/mod.rs`, `src-tauri/src/api/tmdb.rs`, `src-tauri/src/api/anilist.rs`, `src-tauri/src/api/rawg.rs`, `src-tauri/src/api/itunes.rs`, `src-tauri/src/api/auth.rs`, `src-tauri/src/api/watchlist.rs`, `src-tauri/build.rs`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`.

**Extract, per module:** every `#[tauri::command]` name, its parameters, the upstream endpoint it hits, and its return shape. Also note the SQLite schema (`CREATE TABLE` statements in `auth.rs` and `watchlist.rs`).

**Verification command (the command list must match `lib.rs`):**

```bash
grep -c 'pub async fn\|pub fn' src-tauri/src/api/*.rs
grep -o 'api::[a-z_]*::[a-z_0-9]*' src-tauri/src/lib.rs | sort
```

**Expected:** the second command lists exactly 27 entries (8 tmdb, 5 anilist, 2 itunes, 4 rawg, 4 auth, 5 watchlist). If the count differs, the code changed since this plan — use the actual output.

**Completion criterion:** `docs/.review-notes.md` `## Rust backend` section contains a complete command table (name | params | upstream | notes) with a row count matching the grep output.

---

### Task 6: Read the frontend API layer and types

**Files:** `src/lib/types/media.ts`, `src/lib/api/tmdb.ts`, `anilist.ts`, `rawg.ts`, `itunes.ts`, `auth.ts`, `watchlist.ts`, `cloud.ts`.

**Extract:** the exported service object of each file and its methods; which Rust command each method invokes; where mapping to `MediaItem`/`MediaDetail` happens; how `cloud.ts` differs (uses `fetch` + JWT + refresh-token retry on 401, gated by `import.meta.env.VITE_CLOUD_API_URL`).

**Verification command (every invoked command name must exist in `lib.rs`):**

```bash
grep -ho "invoke<\?[^(]*(\s*'[a-z_0-9]*'" -r src/lib/api | grep -o "'[a-z_0-9]*'" | tr -d "'" | sort -u > /tmp/fe_cmds.txt
grep -o 'api::[a-z_]*::\([a-z_0-9]*\)' src-tauri/src/lib.rs | sed 's/.*:://' | sort -u > /tmp/be_cmds.txt
comm -23 /tmp/fe_cmds.txt /tmp/be_cmds.txt
```

**Expected output of the final `comm`:** empty (no frontend call without a backend command). **If it is not empty, that is a finding** — record every orphan name in the report under "Broken IPC calls".

**Completion criterion:** `## Frontend API` section written, and the `comm` output (empty or not) pasted into notes verbatim.

---

### Task 7: Read stores, routes, and components

**Files:** `src/lib/stores/ui.svelte.ts`, `user.svelte.ts`, `watchlist.svelte.ts`; `src/routes/+layout.svelte`, `+layout.ts`, `+page.svelte`, `auth/+page.svelte`, `watchlist/+page.svelte`, `media/[type]/[id]/+page.svelte`; `src/lib/components/media/MediaCard.svelte` and all of `src/lib/components/ui/*.svelte` (`AppBackground`, `CategoryTabs`, `GenreCarousel`, `GenreFilter`, `SearchBar`, `UserButton`, `WatchlistButton`).

**Extract per file:** props, `$state`/`$derived`/`$effect` usage, user-visible behavior, and any deviation from the conventions in `.github/copilot-instructions.md`.

**Convention-violation scan (each should print nothing):**

```bash
grep -rn 'on:click\|on:input\|on:change' src/ ; echo "---legacy-handlers-done"
grep -rn 'writable(\|readable(\|derived(' src/lib/stores ; echo "---legacy-stores-done"
grep -rn '@use\|@import\|@forward' src/lib/components src/routes ; echo "---scss-injection-done"
grep -rn '+page.server.ts\|+layout.server.ts' src/ ; echo "---ssr-done"
```

**Expected:** only the four `---...-done` echo lines. Any other line is a convention violation and a report finding.

**Completion criterion:** `## Frontend UI` section written; the four scan results recorded.

---

### Task 8: Read build/config and security surface

**Files:** `package.json`, `vite.config.js`, `svelte.config.js`, `tsconfig.json`, `.gitignore`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`.

**Checks to run:**

```bash
git ls-files | grep -E '\.db$|\.env'          # expected: .allai/workspace.db, src-tauri/tauriflix.db  → FINDING
ls .github/workflows 2>&1                      # expected: "No such file or directory" → FINDING
grep -n '"lint"' package.json || echo "NO LINT SCRIPT"   # expected: NO LINT SCRIPT → FINDING
grep -rn 'csp' src-tauri/tauri.conf.json       # expected: "csp": null → FINDING
grep -rn 'cfg(test)' src-tauri/src || echo "NO RUST TESTS"
ls src/**/*.test.ts 2>/dev/null || echo "NO FRONTEND TESTS"
```

**Completion criterion:** `## Config & security` section lists each check with its literal output and a severity (high/medium/low).

---

### Task 9: Read the git history and reconstruct the "why"

**Commands:**

```bash
git log --all --date=short --format='%h %ad %d %s' | head -40
git log --all --stat --format='%h %s' -- src-tauri/src/api | head -60
git branch -a
```

**Task:** Write a chronological narrative: scaffold → Netflix UI overhaul (`b37325f`) → multi-API integration (`5b1411b`) → TMDB→TVMaze experiment (`2d930df`) → genre filtering + layout (`3e40cda`) → auth/watchlist/SQLite (`042dd06`) → cloud server connection (`eb3f1bf`). For each, state *what changed and why*, inferred from the diff, not from the message alone.

**Note the TVMaze anomaly:** commit `2d930df` is "changed tmdb to tvmaze" yet the current tree has a live `tmdb.rs`. Determine from `git log -p -- src-tauri/src/api/tmdb.rs` whether TVMaze was reverted, and record the answer.

**Completion criterion:** `## History` section has one paragraph per commit above, plus a resolved answer to the TVMaze question.

---

## Phase 2 — Write the review deliverable

### Task 10: Create `docs/PROJECT_REVIEW.md` skeleton

**Create:** `docs/PROJECT_REVIEW.md`

```markdown
# TauriFlix — Project Review

> Snapshot date: <YYYY-MM-DD> · Commit: <short sha> · Branch: docs/project-review-2026-09

## 1. Executive summary
## 2. Architecture as built
## 3. Feature overview
## 4. Backend command surface
## 5. Frontend surface
## 6. Data & persistence
## 7. Build, config, and CI
## 8. Build health
## 9. Documentation accuracy audit
## 10. History and rationale
## 11. Findings and backlog
```

**Command:**

```bash
git log -1 --format='%h %ad' --date=short   # paste into the snapshot line
```

**Completion criterion:** file exists with all 11 headings and a filled-in snapshot line.

---

### Task 11: Fill sections 2-10 from the notes

**Objective:** Transfer `docs/.review-notes.md` into the report, one section per pass. **Every factual claim must trace to a file path or a command output you actually ran.**

Section 3 (**Feature overview**) is the section the user explicitly asked for. Write it as a table and cover at minimum:

| Feature | Where | Status |
|---|---|---|
| Multi-category browsing (movie, tv, anime, manga, book, game) | `src/lib/components/ui/CategoryTabs.svelte`, `src/routes/+page.svelte` | |
| TMDB movies + series: popular/discover, search, details, genres | `src-tauri/src/api/tmdb.rs`, `src/lib/api/tmdb.ts` | |
| AniList anime + manga: search, details, shared genre collection | `src-tauri/src/api/anilist.rs`, `src/lib/api/anilist.ts` | |
| RAWG games: search, discover, details, genres | `src-tauri/src/api/rawg.rs`, `src/lib/api/rawg.ts` | |
| iTunes books: search, details | `src-tauri/src/api/itunes.rs`, `src/lib/api/itunes.ts` | |
| Unified media type mapping | `src/lib/types/media.ts` | |
| Search bar | `src/lib/components/ui/SearchBar.svelte` | |
| Genre filter + genre carousels | `GenreFilter.svelte`, `GenreCarousel.svelte` | |
| Infinite scroll / pagination | `src/routes/+page.svelte` | |
| Media detail page (cast, videos, screenshots) | `src/routes/media/[type]/[id]/+page.svelte` | |
| Local auth (register/login/list users, SQLite) | `src-tauri/src/api/auth.rs`, `src/routes/auth/+page.svelte` | |
| Session persistence in localStorage | `src/lib/stores/user.svelte.ts` | |
| Route auth guard | `src/routes/+layout.svelte` | |
| Per-user watchlist with want/watching/watched status | `src-tauri/src/api/watchlist.rs`, `src/routes/watchlist/+page.svelte` | |
| Cloud sync mode (JWT + refresh, Axum server) | `src/lib/api/cloud.ts` | |
| Animated canvas/orb background, hover-hue reactivity, click pulse | `AppBackground.svelte`, `src/lib/stores/ui.svelte.ts` | |
| Netflix-style design system (SCSS auto-injection + CSS tokens) | `src/lib/styles/variables.scss`, `global.css` | |

Fill the **Status** column with one of: `Working (verified by reading code)`, `Present but unverified at runtime`, `Partial — <reason>`, `Dead/unused`. Do not write "Working" for anything you have not traced end to end frontend→command→upstream.

**Completion criterion:** no `<placeholder>` or empty table cell remains; `grep -c '^|' docs/PROJECT_REVIEW.md` returns a non-zero count and `grep -n 'TODO\|<...>' docs/PROJECT_REVIEW.md` returns nothing.

---

### Task 12: Write section 11 — Findings and backlog

**Objective:** One row per finding, ranked. Seed it with the 9 known contradictions from Current Context plus anything Tasks 5-9 added.

Format each as:

```markdown
### F-01 — Passwords hashed with a non-cryptographic hash (HIGH)
**Where:** `src-tauri/src/api/auth.rs` (`hash_password`, uses `DefaultHasher`)
**Impact:** Password hashes are trivially brute-forced; the comment claims this is "sufficient for a desktop app" — it is not, and the cloud path already uses Argon2id, so the two backends disagree on security posture.
**Fix sketch:** replace with the `argon2` crate, matching the server's Argon2id; add a migration for existing rows.
**Out of scope for this plan.**
```

Mandatory findings to include (IDs suggested): F-01 auth hashing, F-02 `ci.yml`/`release.yml` not in `.github/workflows/`, F-03 `npm run lint` missing, F-04 committed `*.db` binaries, F-05 zero tests, F-06 stale agent/copilot instructions (wrong providers + wrong palette), F-07 stale README, F-08 stale CHANGELOG, F-09 default `productName`/`identifier`/`csp: null`/`devtools: true` in `tauri.conf.json`.

**Commit:**

```bash
git add docs/PROJECT_REVIEW.md
git commit -m "docs(review): add full project review and feature overview"
```

**Completion criterion:** `git log -1 --stat` shows `docs/PROJECT_REVIEW.md` added; the file contains at least 9 `### F-` headings (`grep -c '^### F-' docs/PROJECT_REVIEW.md` ≥ 9).

---

### Task 13: Delete the scratch notes and commit

```bash
rm docs/.review-notes.md
git status --short   # expected: empty (the notes file was never committed)
```

**Completion criterion:** `ls docs/` shows only `PROJECT_REVIEW.md`.

---

## Phase 3 — Fix the docs that contradict the code

Each of these is a small, independently committed edit. **Only docs change — no source files.**

### Task 14: Fix `README.md`

**Edits:**
1. Delete the stock template block (the "Tauri + SvelteKit + TypeScript / This template should help..." heading and its "Recommended IDE Setup" paragraph) — keep only the `# TauriFlix` document.
2. Replace the tagline line `Tracks movies, TV series, anime, and books via TMDB, Jikan, and OpenLibrary.` with:
   `Tracks movies, TV series, anime, manga, books, and games via TMDB, AniList, RAWG, and iTunes — with optional cloud sync.`
3. In the Stack table, change the `APIs` row value to `TMDB, AniList, RAWG, iTunes`.
4. In the Environment Variables table, add a row:
   `| \`VITE_CLOUD_API_URL\` | No | Base URL of the optional cloud sync server; when unset the app uses local SQLite |`

**Verify:**

```bash
grep -c 'Jikan\|OpenLibrary' README.md    # expected: 0
grep -c 'This template should help' README.md  # expected: 0
grep -c 'VITE_CLOUD_API_URL' README.md    # expected: 1
git add README.md && git commit -m "docs(readme): correct providers, drop template boilerplate, document VITE_CLOUD_API_URL"
```

---

### Task 15: Fix `CHANGELOG.md`

**Replace the `## [Unreleased]` block with:**

```markdown
## [Unreleased]

### Added
- Six media categories: movies, TV series (TMDB), anime + manga (AniList GraphQL), games (RAWG), books (iTunes)
- Unified `MediaItem`/`MediaDetail` type mapping across all providers (`src/lib/types/media.ts`)
- Search, genre filtering, and per-genre carousels on the home page
- Media detail page at `/media/[type]/[id]` with cast, videos, and provider-specific extras
- Local accounts backed by SQLite (`auth_register`, `auth_login`, `auth_get_user`, `auth_list_users`)
- Per-user watchlist with `want` / `watching` / `watched` status, persisted in SQLite
- Optional cloud sync mode (JWT + refresh tokens) enabled by `VITE_CLOUD_API_URL`
- Route auth guard in the root layout; session persisted in `localStorage`
- Infinite scroll with IntersectionObserver
- Netflix-style design system: SCSS variables auto-injected by Vite + CSS custom-property tokens
- Animated background: canvas particles, CSS orbs, hover-hue reactivity, click pulse

### Known issues
- See `docs/PROJECT_REVIEW.md` §11 for the ranked findings list
```

**Verify:**

```bash
grep -c 'AniList' CHANGELOG.md   # expected: ≥1
git add CHANGELOG.md && git commit -m "docs(changelog): bring Unreleased up to date with shipped features"
```

---

### Task 16: Fix the design-system section in `.github/agents/tauriflix.agent.md`

**Objective:** Make the agent file match `src/lib/styles/variables.scss` so the coding agent stops inventing a gold palette.

**Replace the Design System token table rows** for Background / Surface / Gold / Accent / Teal / Text with:

```markdown
| Background | `#000000` (`$color-bg-primary`)                                              |
| Surface    | `#0a0a0a` (`$color-bg-secondary`)                                           |
| Primary    | `#E50914` Netflix Red (`$color-primary`)                                    |
| Accent     | `#B20710` dark red (`$color-accent`)                                        |
| Green      | `#46D369` (`$color-teal`) — watchlist active / success                      |
| Text       | `#F5F5F1` / `#B3B3B3` / `#808080` (`$color-text-main/-muted/-faint`)        |
```

**Also:** replace every occurrence of `TMDB/Jikan/OpenLibrary` and `Jikan, OpenLibrary` with `TMDB, AniList, RAWG, iTunes`, including in the YAML `description:` field.

**Verify:**

```bash
grep -c 'Jikan\|OpenLibrary\|e8b84b\|080b10\|3dd9c4\|ff6b4a' .github/agents/tauriflix.agent.md  # expected: 0
git add .github/agents/tauriflix.agent.md && git commit -m "docs(agent): sync provider list and palette with actual code"
```

---

### Task 17: Fix `.github/copilot-instructions.md`

Apply the same two corrections (provider list, palette token examples — `$color-primary` is Netflix red, not gold). Add one line under `## Conventions`:

```markdown
- Two persistence backends: local SQLite via Tauri commands, or the cloud server when `VITE_CLOUD_API_URL` is set (`src/lib/api/cloud.ts`)
```

**Verify:**

```bash
grep -c 'Jikan\|OpenLibrary' .github/copilot-instructions.md   # expected: 0
grep -c 'VITE_CLOUD_API_URL' .github/copilot-instructions.md   # expected: 1
git add .github/copilot-instructions.md && git commit -m "docs(copilot): sync providers and document cloud mode"
```

---

### Task 18: Re-run validation to prove docs-only changes broke nothing

```bash
npm run check 2>&1 | tail -3
```

**Expected:** identical error/warning counts to the baseline recorded in Task 2. If they differ, you edited a source file by mistake — `git diff` and revert.

**Completion criterion:** the counts match Task 2 verbatim.

---

## Phase 4 — The Tauri skill

### Task 19: Survey existing skills before writing

**Objective:** Avoid duplicating an existing skill and match house style.

```bash
ls ~/.hermes/skills/software-development/
```

Read `~/.hermes/skills/software-development/plan/SKILL.md` frontmatter as a style reference. Confirm no existing skill covers Tauri (expected: none does).

**Completion criterion:** you can state in one line that no Tauri skill exists and which peer skill you used as the style template.

---

### Task 20: Gather the authoritative sources

**Objective:** Ground the skill in docs, not memory. Fetch and skim these with `web_extract`:

- `https://v2.tauri.app/start/frontend/sveltekit/` — SPA checklist, `adapter-static`, `ssr = false`, `frontendDist: "../build"`
- `https://v2.tauri.app/security/capabilities/` — capability JSON shape, `core:*` permission identifiers, platform gating, restricting the command set via `tauri_build::AppManifest::commands`
- `https://v2.tauri.app/develop/tests/mocking/` — `mockIPC`, `mockWindows`, `clearMocks`, `shouldMockEvents` (since Tauri 2.7), vitest + jsdom crypto shim
- `https://v2.tauri.app/start/migrate/from-tauri-1/` — v1→v2 differences
- `https://svelte.dev/docs/svelte/stores` and `https://svelte.dev/docs/svelte/$state` — runes vs legacy stores

**Note the traps worth writing down:** Tauri docs default `devUrl` to `5173` while this project pins `1420`; docs use `fallback: 'index.html'` while SvelteKit SPA mode + this project use `app.html`; `load` functions have no Tauri API access during prerender, which is why SPA (not SSG) is the correct mode.

**Completion criterion:** you have concrete quotes/snippets for: the SPA checklist, a capability file example, and a `mockIPC` vitest example.

---

### Task 21: Create the skill with `skill_manage`

**Objective:** Author `tauri-svelte-rust` as a user-local skill under the `software-development` category.

**Call:** `skill_manage` with `operations: [{ name: "tauri-svelte-rust", action: "create", category: "software-development", content: <below> }]`

**Frontmatter constraints (hard rules from `hermes-agent-skill-authoring`):** file starts at byte 0 with `---`; `description` ≤ 60 chars, one sentence, ends with a period, no marketing words; description containing `:` must be quoted.

**Content:**

````markdown
---
name: tauri-svelte-rust
description: Build Tauri 2 desktop apps with SvelteKit, TS, and Rust.
version: 0.1.0
author: Rafael Moraes (rafaelsm993), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Tauri, Svelte, SvelteKit, Rust, TypeScript, Desktop, IPC]
    related_skills: [plan, test-driven-development]
---

# Tauri 2 + SvelteKit + Rust Skill

Full-stack workflow for Tauri 2 desktop apps whose frontend is a SvelteKit SPA
(Svelte 5 runes, TypeScript) and whose backend is Rust `#[tauri::command]` handlers.
Covers project shape, the IPC contract, capabilities/permissions, and testing.
Does not cover mobile targets or Tauri 1.

## When to Use

- Adding, renaming, or debugging a `#[tauri::command]` and its `invoke()` caller
- Wiring a new HTTP/API provider through the Rust backend
- SvelteKit SPA configuration for Tauri (`adapter-static`, `ssr = false`)
- Svelte 5 runes state / class-based stores in `*.svelte.ts`
- Capability, permission, or CSP errors at runtime
- Writing tests for either side of the IPC bridge
- Don't use for: pure web SvelteKit apps with a Node server, or Tauri 1 codebases

## Prerequisites

- Node 20+, Rust stable, and a system WebView (WebView2 on Windows, WebKitGTK on Linux)
- `npm install` completed; `src-tauri/` builds with `cargo check`
- Secrets in a gitignored `.env`; never inline a key in source

## Quick Reference

```
npm run tauri dev                  # Vite dev server + Tauri window
npm run tauri build                # production bundle → src-tauri/target/release/bundle/
npm run check                      # svelte-kit sync && svelte-check
cd src-tauri && cargo check        # Rust type check
cd src-tauri && cargo clippy -- -D warnings
cd src-tauri && cargo fmt --check
npx vitest run                     # frontend tests (after Procedure §5)
```

## Project Shape

| What | Where |
|---|---|
| Rust commands | `src-tauri/src/api/<provider>.rs` |
| Rust module registry | `src-tauri/src/api/mod.rs` |
| Command registration | `src-tauri/src/lib.rs` (`tauri::generate_handler![]`) |
| Tauri config | `src-tauri/tauri.conf.json` |
| Capabilities | `src-tauri/capabilities/*.json` |
| Compile-time env injection | `src-tauri/build.rs` |
| Frontend IPC services | `src/lib/api/*.ts` |
| Shared types | `src/lib/types/*.ts` |
| Runes stores | `src/lib/stores/*.svelte.ts` |
| Routes | `src/routes/**/+page.svelte` |

## Procedure

### 1. SPA configuration (do this once, verify it never regresses)

Tauri has no Node server, so SSR is impossible. Three files must agree:

- `svelte.config.js` — `adapter-static({ fallback: 'app.html' })`
- `src/routes/+layout.ts` — `export const ssr = false;`
- `src-tauri/tauri.conf.json` — `"frontendDist": "../build"` and `"devUrl"` equal to the
  Vite port in `vite.config.js` (`server.port`, commonly `1420`; the Tauri docs' `5173`
  is the framework default, not a rule).

Prefer SPA over SSG-with-prerender: prerendered `load` functions run in Node at build
time and have **no access to Tauri APIs**.

**Done when:** `npm run build` produces `build/app.html` and `npm run tauri dev` opens a
window that routes client-side without a blank screen.

### 2. Add a Rust command

```rust
// src-tauri/src/api/example.rs
use reqwest::Client;
use serde_json::Value;

const BASE: &str = "https://api.example.com";

#[tauri::command]
pub async fn example_search(query: String, page: u32) -> Result<Value, String> {
    eprintln!("[example] search query={query} page={page}");
    let res = Client::new()
        .get(format!("{BASE}/search"))
        .query(&[("q", query.as_str()), ("page", &page.to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res)
}
```

Then register it in **both** places — forgetting either yields a runtime
`Command example_search not found`:

```rust
// src-tauri/src/api/mod.rs
pub mod example;
```

```rust
// src-tauri/src/lib.rs — inside tauri::generate_handler![]
api::example::example_search,
```

**Done when:** `cd src-tauri && cargo check` succeeds and the command name appears in
`lib.rs`.

### 3. Call it from the frontend

Argument names cross the bridge in **camelCase** from JS and are received as
**snake_case** by Rust — `invoke('cmd', { userId })` binds to `user_id: i64`. A mismatch
surfaces as `invalid args ... missing required key`.

```ts
// src/lib/api/example.ts
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, PaginatedResult } from '$lib/types/media';

interface RawExample { results: any[]; page: number; total_pages: number; total_results: number }

function map(raw: any): MediaItem { /* provider JSON → shared shape */ return raw; }

export const ExampleAPI = {
  async search(query: string, page = 1): Promise<PaginatedResult<MediaItem>> {
    const raw = await invoke<RawExample>('example_search', { query, page });
    return {
      results: raw.results.map(map),
      page: raw.page,
      total_pages: raw.total_pages,
      total_results: raw.total_results,
    };
  },
};
```

**Done when:** `npm run check` reports no new errors and the call returns data in the
running app.

### 4. Svelte 5 state

Use runes; legacy `writable()`/`readable()` and `on:click` are wrong in a Svelte 5
codebase. A module holding `$state` must be named `*.svelte.ts` or the rune is not
compiled.

```ts
// src/lib/stores/example.svelte.ts
class ExampleStore {
  items = $state<string[]>([]);
  loading = $state(false);
  count = $derived(this.items.length);

  add(v: string) { this.items = [...this.items, v]; }
}

export const exampleStore = new ExampleStore();
```

In components: `$props()`, `$state`, `$derived`, `$effect`; handlers are `onclick=`,
`oninput=`; reusable markup is `{#snippet Name()}…{/snippet}` + `{@render Name()}`.

**Done when:** the four scans in *Pitfalls* return no matches.

### 5. Test the IPC boundary

Frontend — mock the bridge with `@tauri-apps/api/mocks` so no Rust is needed:

```ts
// src/lib/api/example.test.ts
import { beforeAll, afterEach, expect, test, vi } from 'vitest';
import { randomFillSync } from 'crypto';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { ExampleAPI } from './example';

beforeAll(() => {
  // jsdom has no WebCrypto; @tauri-apps/api needs it
  Object.defineProperty(window, 'crypto', {
    value: { getRandomValues: (b: any) => randomFillSync(b) },
  });
});

afterEach(() => clearMocks());

test('search maps the raw envelope', async () => {
  mockIPC((cmd, args: any) => {
    if (cmd === 'example_search') {
      expect(args.query).toBe('dune');
      return { results: [{ id: 1 }], page: 1, total_pages: 3, total_results: 42 };
    }
  });
  const page = await ExampleAPI.search('dune');
  expect(page.total_pages).toBe(3);
  expect(page.results).toHaveLength(1);
});
```

Setup: `npm i -D vitest jsdom` and add `"test": "vitest run"` to `package.json` scripts;
set `test: { environment: 'jsdom' }` in `vite.config.js`.

Backend — keep pure mapping/validation logic in free functions and test them with
`#[cfg(test)] mod tests` under `cargo test`; `#[tauri::command]` handlers that do network
I/O are not unit-testable without a live app handle.

**Done when:** `npx vitest run` and `cd src-tauri && cargo test` both pass.

### 6. Capabilities, permissions, CSP

Every capability file in `src-tauri/capabilities/` is enabled by default. A capability
names the windows it applies to and the permissions it grants:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the main window",
  "windows": ["main"],
  "platforms": ["linux", "macOS", "windows"],
  "permissions": ["core:default", "opener:default"]
}
```

Your own `#[tauri::command]`s are callable from every window by default — narrow that with
`tauri_build::AppManifest::new().commands(&["..."])` in `build.rs` when it matters.
`"csp": null` in `tauri.conf.json` disables the Content-Security-Policy entirely; set a
real policy before shipping, remembering that remote images/fonts need explicit
`img-src`/`font-src` entries.

**Done when:** the app runs with the intended permission list and no
`plugin ... not allowed` errors in the console.

### 7. Secrets

Load keys from a gitignored `.env`. A `build.rs` that emits `cargo:rustc-env=KEY=value`
bakes the value in at compile time; read it at runtime with an env-var override first:

```rust
fn api_key() -> String {
    std::env::var("API_KEY").unwrap_or_else(|_| env!("API_KEY").to_string())
}
```

Note the tradeoff: a compile-time key ships inside the binary and is extractable — for
anything that must stay secret, proxy through a server instead.

**Done when:** `git ls-files | grep '\.env$'` prints nothing and no literal key appears in
`src/` or `src-tauri/src/`.

## Pitfalls

1. **Command not registered in both `mod.rs` and `lib.rs`** — compiles fine, fails at
   runtime with `Command <name> not found`.
2. **camelCase/snake_case argument mismatch** across `invoke()` — `invalid args`.
3. **`$state` in a plain `.ts` file** — runes only compile in `.svelte` and `.svelte.ts`.
4. **`devUrl` not matching `vite.config.js` `server.port`** — Tauri opens a blank window.
5. **SSG prerendering instead of SPA** — `load` functions run in Node and cannot call
   Tauri APIs.
6. **`@use`/`@import` in a component `<style lang="scss">` when Vite already injects
   variables** via `css.preprocessorOptions.scss.additionalData` — duplicate-import errors.
7. **`csp: null` left in the shipped config** — no CSP protection at all.
8. **Committing `*.db` / `target/` artifacts** — check `.gitignore` covers
   `src-tauri/target/` and any local database file.
9. **jsdom has no WebCrypto** — `@tauri-apps/api` throws in vitest without the
   `window.crypto` shim shown above.

## Verification

Run all five; each must be clean before calling a change done:

```bash
npm run check                                   # 0 new svelte-check errors
cd src-tauri && cargo check && cargo clippy -- -D warnings && cd ..
npx vitest run                                  # frontend tests pass
grep -rn 'on:click\|on:input' src/              # no output
grep -rn '@use\|@import\|@forward' src/lib/components src/routes   # no output
```
````

**Completion criterion:** `skill_manage` returns success and
`ls ~/.hermes/skills/software-development/tauri-svelte-rust/SKILL.md` exists.

---

### Task 22: Validate the skill file

```bash
python3 - <<'PY'
import yaml, re, pathlib
p = pathlib.Path.home()/".hermes/skills/software-development/tauri-svelte-rust/SKILL.md"
c = p.read_text()
assert c.startswith("---"), "must start with ---"
m = re.search(r'\n---\s*\n', c[3:]); fm = yaml.safe_load(c[3:m.start()+3])
assert fm["name"] == "tauri-svelte-rust"
d = fm["description"]
assert len(d) <= 60, f"description {len(d)} chars"
assert d.endswith("."), "description must end with a period"
assert "platforms" in fm and len(c) <= 100_000
print("OK", len(d), "chars description,", len(c), "chars total")
PY
```

**Expected output:** a line beginning `OK ` with a description length ≤ 60.

**Completion criterion:** the script prints `OK ...` and exits 0. Note: the *current*
Hermes session will not see the new skill via `skill_view` — the loader is cached at
session start. That is expected, not a bug.

---

### Task 23: Final commit and summary

```bash
git log --oneline docs/project-review-2026-09 ^main | cat
git status --short      # expected: empty
```

**Expected:** 6 commits (review, README, CHANGELOG, agent, copilot, plus this plan file if
you choose to track it). The skill lives outside the repo in `~/.hermes/skills/` and is
intentionally not committed here.

**Completion criterion:** clean tree, 6 commits listed, `docs/PROJECT_REVIEW.md` present.

---

## Tests / Validation Summary

This plan is documentation + skill authoring; there is no production code to TDD. The
equivalent discipline applied here:

| Deliverable | Failing-state check | Pass check |
|---|---|---|
| Review accuracy | every claim must cite a path or a command output | Task 11 completion greps return no placeholders |
| Docs fixes | `grep -c 'Jikan\|OpenLibrary'` > 0 before | `== 0` after (Tasks 14, 16, 17) |
| No collateral damage | `npm run check` baseline in Task 2 | identical counts in Task 18 |
| IPC integrity claim | `comm -23 fe_cmds be_cmds` in Task 6 | empty, or the orphans are recorded as findings |
| Skill validity | frontmatter script fails on a >60-char description | Task 22 prints `OK` |

If Task 22's script must be run more than three times on the same file, stop and ask
rather than iterating further on the frontmatter.

---

## Risks, Tradeoffs, Open Questions

**Risks**
- *Detached HEAD.* If Task 1 is skipped, commits are unreachable. Run it first.
- *Scope creep into fixes.* The findings in Task 12 are tempting (especially F-01 auth
  hashing). Fixing them here mixes a docs PR with a security change. Keep them as backlog.
- *`docs/` directory did not previously exist.* Confirm it is not gitignored before Task 10
  (`git check-ignore -v docs/PROJECT_REVIEW.md` should print nothing).
- *Runtime claims without running the app.* Unless you actually run `npm run tauri dev`
  with a valid `TMDB_API_KEY`, every feature status must be `Present but unverified at
  runtime`, not `Working`.

**Tradeoffs**
- The skill is created **user-local** (`~/.hermes/skills/`) rather than in-repo, because
  this repo is an application, not the hermes-agent repo. If it should ship with a team,
  it must instead be authored into the hermes-agent tree with tests and regenerated docs.
- The review lives in-repo at `docs/PROJECT_REVIEW.md` rather than in the Obsidian vault,
  so it versions with the code. The vault stays the long-form reference.

**Open questions for the user**
1. Should `docs/PROJECT_REVIEW.md` live in the repo, or be written into the Obsidian vault
   at `Programming/Tauri_APP/Project Review.md` instead?
2. Should the cloud server repo (`~/Code/tauri-app_server`) be reviewed in the same pass,
   or is this review deliberately app-only?
3. Do you want a follow-up plan that actually fixes F-01 (Argon2 password hashing),
   F-02 (move `ci.yml`/`release.yml` into `.github/workflows/`), and F-04 (untrack the
   committed `.db` files)?
4. Is the TVMaze experiment (`2d930df`) dead code to remove, or a deliberate fallback?
