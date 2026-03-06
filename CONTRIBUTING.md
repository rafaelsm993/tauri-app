# Contributing to TauriFlix

## Branch Strategy

```
main          ← stable, tagged releases only
release/x.y   ← release candidate branch (created from dev before tagging)
dev           ← integration branch, always deployable
feat/name     ← new features (branch from dev)
fix/name      ← bug fixes    (branch from dev)
chore/name    ← tooling, deps, refactors (branch from dev)
```

### Flow

```
feat/my-feature  ──PR──▶  dev  ──PR──▶  release/1.2  ──PR──▶  main
                                                                  │
                                                              tag v1.2.0
```

1. All day-to-day work branches off **`dev`**
2. When a release is ready, open a PR from `dev` → `release/x.y`
3. Only bug fixes go into `release/x.y` after branching
4. When release branch is stable, merge into **`main`** and tag `vX.Y.Z`
5. Tag push triggers the GitHub Actions release workflow (builds installers)

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(media): add anime search via Jikan API
fix(background): remove mix-blend-mode causing WebView flicker
chore(deps): bump tauri to 2.11
docs(readme): add installation steps
refactor(tmdb): extract mapPage helper
```

Types: `feat` `fix` `chore` `docs` `refactor` `test` `perf` `ci`

## Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/tauriflix
cd tauriflix
npm install

# 2. Configure secrets
cp .env.example .env
# Edit .env — add your TMDB_API_KEY

# 3. Run dev
npm run tauri dev
```

## Adding a New API Provider (Jikan, OpenLibrary, etc.)

1. Add Rust commands in `src-tauri/src/api/<provider>.rs`
2. Register commands in `src-tauri/src/lib.rs`
3. Create `src/lib/api/<provider>.ts` — implement `search()` and `discover()`, map to `MediaItem`
4. No changes needed to `MediaCard` or `+page.svelte` — they consume `MediaItem` generically
