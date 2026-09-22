# Import the Obsidian Tauri_APP notes into docs/ — Implementation Plan

> For Hermes: execute task-by-task. The user commits manually in this repo — NEVER run `git add`, `git commit`, `git push`, `git reset`, or create branches. "Checkpoint" means: stop, report, let the user commit.

Goal: Copy the 8 Obsidian notes for this project into `docs/notes/` (vault untouched), make them portable, flag the sections that describe code that has since been deleted, and link them from the repo's docs entry points — guarded by a `node --test` structural test.

Architecture: Byte-for-byte copy first (verified by sha256), then two small, mechanical, reviewable edits on the copies only: (1) replace dead `vscode-file://` editor links with inline code, (2) prepend a fixed "stale" banner to the 6 notes that document the removed auth/watchlist/cloud/SQLite layer. A new `scripts/docs-notes.test.mjs` (same style as the existing `scripts/no-auth.test.mjs`) asserts all of this so it can't silently regress.

Tech stack: Markdown, Node 22 built-in test runner (`node --test`). No new dependencies.

---

## Current context (verified by read-only inspection, 2026-09-22)

The project (TauriFlix):
- Tauri 2 desktop app: SvelteKit static SPA (Svelte 5 runes, TypeScript, SCSS auto-injected via Vite) + Rust backend that is now a STATELESS proxy over 4 providers: TMDB (movies/TV), AniList (anime/manga), RAWG (games), iTunes (books).
- Routes today: `src/routes/+page.svelte` (home) and `src/routes/media/[type]/[id]/+page.svelte` (detail) only. `src-tauri/src/lib.rs` registers 19 commands (8 TMDB, 5 AniList, 2 iTunes, 4 RAWG).
- Auth, watchlist, cloud sync, `rusqlite`, `greet` were REMOVED (see `CHANGELOG.md` "Removed" and plan `.hermes/plans/2026-09-21_202018-strip-auth-and-watchlist.md`). `scripts/no-auth.test.mjs` guards that removal.
- Build is WSL-edit / Windows-build: `scripts/wdev.sh`, `scripts/*.ps1`, runbook `docs/BUILD_AND_RUN.md`.
- Tests: no npm test script. Tests are plain `node --test scripts/<name>.test.mjs` files run from repo root.
- Existing docs: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/BUILD_AND_RUN.md`, `docs/PROJECT_REVIEW.md` (59 KB; has its own banner saying auth/watchlist/cloud/SQLite sections are stale). `docs/PROJECT_REVIEW.md` §9 already audited every vault note — use it as the accuracy reference.
- Branch `chore/wsl-windows-build-pipeline`, working tree clean.

The vault source: `/run/media/user/FILES/Projects/obisidian-journal/Programming/Tauri_APP/` (same disk as `/mnt/FILES`; the vault is its own git repo — do NOT write to it).

| Source file | sha256 (first 12) | auth/watchlist/cloud/sqlite hits | Banner? |
|---|---|---|---|
| `API Reference.md` | 2c5792bbc81c | 67 | yes |
| `Architecture.md` | 82b06552ca93 | 54 | yes |
| `Cloud Server.md` | da7ce8e18804 | 51 (whole note is about the removed server integration) | yes |
| `Component Patterns.md` | e809bb3d74ba | 19 | yes |
| `Config and Stack.md` | ef1f06d0beca | 11 | yes |
| `Design System.md` | 466c8135e826 | 1 | no |
| `Learning roadmap.md` | 6139da0e2929 | 1 | no |
| `Front-end/SvelteKit Special Pages.md` | a1d034329073 | 14 | yes |

Other facts:
- No `[[wikilinks]]` and no embedded images in any note — nothing to rewrite for Obsidian syntax.
- `Learning roadmap.md` contains 59 links of the form `[name](vscode-file://vscode-app/.../workbench.html)` — dead outside the author's VS Code window. No other note has them.
- `Config and Stack.md`, `Design System.md`, `Learning roadmap.md` start with `##` / blank line (no H1). Leave as-is.
- `Cloud Server.md` contains example `DATABASE_URL=postgres://user:***@...` / `JWT_SECRET=change-me...` placeholders — not real secrets; copy as-is.

## Decisions (made; change only if the user objects)

1. COPY, not move. The vault stays the user's journal; the repo gets a snapshot. (Open question below.)
2. Destination `docs/notes/`, keeping ORIGINAL filenames (spaces included) and the `Front-end/` subfolder, so each file is traceable to its vault source by name + hash.
3. Do NOT rewrite stale content. Mark it with a banner and point to the current truth. Rewriting 6 notes is a separate, larger task.

---

## Task 1: Baseline

Run:
```
cd /mnt/FILES/Projects/tauri-app
git status --short
node --test scripts/no-auth.test.mjs 2>&1 | grep -E '^# (pass|fail)'
test -e docs/notes && echo EXISTS || echo ABSENT
```
Expected: empty `git status`; `# pass 7` and `# fail 0`; `ABSENT`. If `docs/notes` exists, stop and ask.

## Task 2: Write the failing structural test

Create: `scripts/docs-notes.test.mjs`

```js
// scripts/docs-notes.test.mjs
// Structural guard for the Obsidian notes imported into docs/notes/.
// Run from the repo root:  node --test scripts/docs-notes.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const NOTES = "docs/notes";
const read = (p) => readFileSync(join(root, p), "utf8");

const ALL = [
  "API Reference.md",
  "Architecture.md",
  "Cloud Server.md",
  "Component Patterns.md",
  "Config and Stack.md",
  "Design System.md",
  "Learning roadmap.md",
  "Front-end/SvelteKit Special Pages.md",
];

const STALE = [
  "API Reference.md",
  "Architecture.md",
  "Cloud Server.md",
  "Component Patterns.md",
  "Config and Stack.md",
  "Front-end/SvelteKit Special Pages.md",
];

const BANNER_MARKER = "<!-- stale-banner -->";

test("all 8 notes are imported", () => {
  for (const f of ALL) {
    assert.ok(existsSync(join(root, NOTES, f)), `${NOTES}/${f} missing`);
  }
});

test("index lists every note", () => {
  const index = read(`${NOTES}/README.md`);
  for (const f of ALL) {
    const href = encodeURI(f);
    assert.ok(index.includes(`](${href})`), `index does not link ${f}`);
  }
});

test("no dead vscode-file links remain", () => {
  for (const f of ALL) {
    assert.ok(
      !read(`${NOTES}/${f}`).includes("vscode-file://"),
      `${f} still has vscode-file:// links`,
    );
  }
});

test("stale notes start with the banner, current notes do not", () => {
  for (const f of ALL) {
    const body = read(`${NOTES}/${f}`);
    if (STALE.includes(f)) {
      assert.ok(body.startsWith(BANNER_MARKER), `${f} lacks stale banner`);
    } else {
      assert.ok(!body.includes(BANNER_MARKER), `${f} should not be bannered`);
    }
  }
});

test("repo entry points link the notes index", () => {
  assert.ok(read("README.md").includes("](docs/notes/README.md)"));
});
```

Run: `node --test scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'`
Expected: `# pass 0`, `# fail 5` (directory doesn't exist yet).

## Task 3: Copy the notes verbatim

Run (fish-safe; quotes handle the spaces):
```
mkdir -p docs/notes/Front-end
cp -p "/run/media/user/FILES/Projects/obisidian-journal/Programming/Tauri_APP/"*.md docs/notes/
cp -p "/run/media/user/FILES/Projects/obisidian-journal/Programming/Tauri_APP/Front-end/SvelteKit Special Pages.md" docs/notes/Front-end/
```

Verify byte-identical copies (must happen BEFORE any edit):
```
cd "/run/media/user/FILES/Projects/obisidian-journal/Programming/Tauri_APP" && sha256sum *.md Front-end/*.md > /tmp/vault.sha
cd /mnt/FILES/Projects/tauri-app/docs/notes && sha256sum -c /tmp/vault.sha
cd /mnt/FILES/Projects/tauri-app
```
Expected: 8 lines ending `: OK`, no `FAILED`.

Then: `node --test scripts/docs-notes.test.mjs 2>&1 | grep -E '^not ok|^ok'`
Expected: `ok 1 - all 8 notes are imported`; tests 2–5 still `not ok`.

## Task 4: Replace dead vscode-file links in Learning roadmap.md

Only `docs/notes/Learning roadmap.md` has them. Turn `[text](vscode-file://...)` into `` `text` `` (text is always a filename or identifier like `tmdb.rs`, `$state`, `+page.svelte`). Guessing real repo paths for 9 different `+page.svelte` links is error-prone, and several targets (e.g. `watchlist.svelte.ts`) no longer exist — inline code is the honest, deterministic rewrite.

Run:
```
node -e '
const fs = require("fs");
const p = "docs/notes/Learning roadmap.md";
const src = fs.readFileSync(p, "utf8");
const out = src.replace(/\[([^\]]+)\]\(vscode-file:\/\/[^)]*\)/g, (_, t) => "`" + t + "`");
fs.writeFileSync(p, out);
console.log("replaced", (src.match(/vscode-file:\/\//g) || []).length, "remaining", (out.match(/vscode-file:\/\//g) || []).length);
'
```
Expected: `replaced 59 remaining 0`.

Spot-check: `grep -n 'app.html' "docs/notes/Learning roadmap.md" | head -2` → line 5 shows `` `app.html` `` in the last table cell. Some cells will read like `` `global.css` (`:root` block, lines 12–130) `` — fine; line numbers are historical.

Note: a few link texts already contained backticks? Run `grep -c '``' "docs/notes/Learning roadmap.md"`; expected `0`. If >0, fix those lines by hand to single backticks.

## Task 5: Prepend the stale banner to the 6 affected notes

Banner text (exact; first line is the marker the test checks):
```
<!-- stale-banner -->
> **Partly stale — imported from the Obsidian vault on 2026-09-22.**
> Sections on login/accounts, the watchlist, cloud sync (`tauri-app_server`, `VITE_CLOUD_API_URL`) and the SQLite layer describe code that has been **removed** (see `CHANGELOG.md` → Removed). The app is now Home + Detail over TMDB, AniList, RAWG and iTunes only. For the accuracy audit of this note see [PROJECT_REVIEW §9](../PROJECT_REVIEW.md#9-documentation-accuracy-audit) — the source code wins when they disagree.

```
(The banner ends with one blank line so the original first line stays a separate block.)

For `Front-end/SvelteKit Special Pages.md` the relative link must be `../../PROJECT_REVIEW.md#9-documentation-accuracy-audit`.

Run:
```
node -e '
const fs = require("fs");
const banner = (up) => `<!-- stale-banner -->
> **Partly stale — imported from the Obsidian vault on 2026-09-22.**
> Sections on login/accounts, the watchlist, cloud sync (\`tauri-app_server\`, \`VITE_CLOUD_API_URL\`) and the SQLite layer describe code that has been **removed** (see \`CHANGELOG.md\` → Removed). The app is now Home + Detail over TMDB, AniList, RAWG and iTunes only. For the accuracy audit of this note see [PROJECT_REVIEW §9](${up}PROJECT_REVIEW.md#9-documentation-accuracy-audit) — the source code wins when they disagree.

`;
const files = {
  "API Reference.md": "../",
  "Architecture.md": "../",
  "Cloud Server.md": "../",
  "Component Patterns.md": "../",
  "Config and Stack.md": "../",
  "Front-end/SvelteKit Special Pages.md": "../../",
};
for (const [f, up] of Object.entries(files)) {
  const p = "docs/notes/" + f;
  const body = fs.readFileSync(p, "utf8");
  if (body.startsWith("<!-- stale-banner -->")) { console.log("skip", f); continue; }
  fs.writeFileSync(p, banner(up) + body);
  console.log("bannered", f);
}
'
```
Expected: 6 `bannered ...` lines. Re-running prints 6 `skip` lines (idempotent).

Verify the anchor exists: `grep -n '^## 9. Documentation accuracy audit' docs/PROJECT_REVIEW.md` → `255:## 9. Documentation accuracy audit`. (GitHub slug of that heading is `9-documentation-accuracy-audit`.)

## Task 6: Write the notes index

Create: `docs/notes/README.md`

```markdown
# Design notes (imported from Obsidian)

Snapshot of the author's Obsidian vault folder `Programming/Tauri_APP/`, copied on 2026-09-22. The vault remains the original; these copies are for reading alongside the code. Notes marked **stale** still describe the removed login/watchlist/cloud/SQLite layer — the source code and [PROJECT_REVIEW §9](../PROJECT_REVIEW.md#9-documentation-accuracy-audit) win when they disagree.

Only two edits were made to the copies: dead `vscode-file://` editor links in the learning roadmap became inline code, and a stale banner was added where noted.

| Note | What it covers | Status |
|---|---|---|
| [Architecture](Architecture.md) | SPA ↔ Rust IPC topology, data flow, stores, build pipeline | stale sections |
| [API Reference](API%20Reference.md) | Provider commands (TMDB, AniList, RAWG, iTunes), frontend services, shared types | stale sections |
| [Component Patterns](Component%20Patterns.md) | Props and behavior of every UI component and page | stale sections |
| [SvelteKit Special Pages](Front-end/SvelteKit%20Special%20Pages.md) | `+page`/`+layout` conventions, SPA mode, route pages | stale sections |
| [Config and Stack](Config%20and%20Stack.md) | npm scripts, dependencies, config file roles, system requirements | stale sections |
| [Design System](Design%20System.md) | Color, type, spacing, motion tokens, SCSS mixins | current |
| [Learning roadmap](Learning%20roadmap.md) | Personal study path mapped to project files (checkmarks = study progress, not features) | current |
| [Cloud Server](Cloud%20Server.md) | Companion Axum/PostgreSQL server — **integration removed from the app** | historical |
```

Note on the test: `encodeURI("API Reference.md")` → `API%20Reference.md` and `encodeURI("Front-end/SvelteKit Special Pages.md")` → `Front-end/SvelteKit%20Special%20Pages.md`, which is exactly what the table links use. Do not use `<...>` angle-bracket links or literal spaces.

Run: `node --test scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'`
Expected: `# pass 4`, `# fail 1` (README link still missing).

## Task 7: Link the index from README.md

Modify `README.md`: directly after the line
`Build and run on WSL + Windows 11: see [Build and run runbook](docs/BUILD_AND_RUN.md).`
add a blank line and:
```
Architecture, API, component and design-system notes: see [Design notes](docs/notes/README.md) (imported from Obsidian; some sections are stale).
```

Run: `node --test scripts/docs-notes.test.mjs 2>&1 | grep -E '^# (pass|fail)'`
Expected: `# pass 5`, `# fail 0`.

## Task 8: Full verification

```
node --test scripts/docs-notes.test.mjs scripts/no-auth.test.mjs 2>&1 | grep -E '^# (pass|fail)'
```
Expected: `# pass 12`, `# fail 0` — confirms the imported notes don't trip the no-auth guard (it only scans `src/`, `src-tauri/`, so this should hold; if it fails, report, don't "fix" the notes).

```
npm run check 2>&1 | tail -3
```
Expected: `svelte-check found 0 errors and 0 warnings` (docs must not affect it; this proves nothing under `src/` changed).

Vault untouched:
```
cd "/run/media/user/FILES/Projects/obisidian-journal" && git status --short -- Programming/Tauri_APP; cd /mnt/FILES/Projects/tauri-app
```
Expected: empty output.

Diff scope:
```
git status --short
```
Expected exactly:
```
 M README.md
?? docs/notes/
?? scripts/docs-notes.test.mjs
```
(plus this plan file if still untracked). Anything else → revert it.

Review the only non-copy edits: `git diff --no-index "/run/media/user/FILES/Projects/obisidian-journal/Programming/Tauri_APP" docs/notes` (exits 1 when there are differences, which is expected) — hunks must be ONLY the 6 banners and the Learning roadmap link rewrites, plus the new `README.md`.

## Checkpoint

Stop. Report the file list and test output. Suggested commit message for the user (do not run it):
`docs(notes): import Obsidian design notes with stale-section banners`

---

## Risks, tradeoffs, open questions

- "Transfer" = copy or move? Plan COPIES; the vault is untouched. If the user wants the repo to become the single source of truth, a follow-up would delete the vault folder (in the vault repo, by the user) — not done here.
- Two sources will drift. The repo copy is a dated snapshot; edits made later in Obsidian won't flow in. Re-import = re-run Tasks 3–5 (Task 5 is idempotent; Task 4 is a no-op on already-clean text). A sync script is YAGNI until the user asks.
- Stale content is flagged, not fixed. Six notes still describe auth/watchlist/cloud. Rewriting them to match the Home+Detail app is the natural next task (PROJECT_REVIEW §9 lists the exact drift per note). Should `Cloud Server.md` be imported at all, given the integration is gone? Kept as historical context; drop it (and its index row + test entries) if the user prefers.
- Filenames with spaces are awkward in shells and URLs but keep 1:1 traceability with the vault. Alternative: kebab-case renames — rejected to keep diffs against the vault trivial.
- Related drift outside this task (not touched): `docs/BUILD_AND_RUN.md:33` still lists `VITE_CLOUD_API_URL` as a required `.env` key; `docs/PROJECT_REVIEW.md` is itself bannered stale. Worth a small follow-up.
- `Learning roadmap.md` is personal study tracking (checkboxes, `==highlights==`). It's useful onboarding context but is personal; confirm the user is fine with it in a public repo (README clones from `github.com/rafaelsm993/tauri-app`).
