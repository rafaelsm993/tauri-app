# TauriFlix — Project Review

> Reviewed 2026-09-14. Application source snapshot: `eb3f1bf27456d193136db095cd13bacda9088c7e` (`server connection logic`, 2026-05-02). Review branch: `docs/project-review-2026-09`.
>
> This is a review of the checked-out application, not every branch tip or the companion server. Existing refs include later commits such as `48813eb` and `1e45547`; they were not merged into this snapshot. Production source, configuration, databases and the Obsidian vault were not modified by this review.

## 1. Executive summary

TauriFlix is a desktop catalog/discovery and watchlist application, not a streaming player, ebook reader or game launcher. It browses six media categories through four providers: TMDB movies/TV, AniList anime/manga, RAWG games and iTunes books. The frontend is a SvelteKit static SPA using Svelte 5 runes and TypeScript; Rust handles media HTTP requests and local SQLite accounts/watchlists. Optional cloud HTTP is a separate account/watchlist backend.

The frontend type-check and static build pass, and the Windows Rust build check passes. There is no application test suite: the native test command succeeds with zero tests. Strict Clippy fails on two existing warnings; rustfmt check also fails. No native window, live media endpoint or companion-server deployment was exercised, so features below are source-traced, not certified working end to end.

The highest-priority gaps are insecure local password hashing, missing native account authorization, watchlist identity collisions, incomplete watchlist/session lifecycle, and stale asynchronous results. The local watchlist collision was reproduced using SQL extracted from the source and synthetic rows in an in-memory database; no application database was opened. Current CI/release YAML files are outside GitHub's workflow directory and therefore inactive in this checkout.

Important corrections to the original plan:

- **29 registered commands**, comprising 28 API commands and the unused scaffold `greet`, not 27. All 28 distinct frontend service invocation names resolve to registered commands.
- **No root route auth guard.** The auth page redirects already-logged-in users; the root layout does not protect routes.
- **Cloud backend selection is not offline synchronization.** The bulk-sync wrapper exists but has no caller.
- **Current background is CSS-only.** Canvas, automatic hover-hue changes and wired click pulses are not current user-facing features.
- **Both primary token layers match the Netflix palette.** Old gold-named identifiers and some hardcoded older effects remain; there is no wholesale CSS/SCSS primary-palette conflict.
- Root YAML placement proves current workflow inactivity, **not** that CI has never run historically.

### Scope and evidence rules

Read coverage: all 37 tracked source files under `src/` and `src-tauri/src/` (28 frontend, 9 Rust), all 10 requested repository documentation/workflow/setup files, all 8 Obsidian Markdown notes, and relevant manifests/configuration/build files. The baseline has 82 tracked files; the 37 source files contain 8,039 physical lines, not a language-aware executable-LOC metric. Counts were computed from `git ls-files`, source reads and a TypeScript AST scan; details are in Appendix A.

Secrets, `.env`, credential files, database contents, generated build trees and binary assets were excluded from content inspection. Tracked database paths were identified without reading their contents. Lockfiles were parsed for relevant dependency versions rather than treated as documentation. Companion server stack/schema/security claims are explicitly **documentation-only**. Static findings are not presented as observed live exploits or UI screenshots.

## 2. Architecture as built

```text
SvelteKit SPA (src/routes, components, rune stores)
  ├─ media API services → @tauri-apps/api/core invoke
  │    → lib.rs registered Rust commands → TMDB / AniList / RAWG / iTunes
  ├─ local account/watchlist services → invoke
  │    → managed Mutex<rusqlite::Connection> → relative tauriflix.db
  └─ configured cloud account/watchlist path → browser fetch
       → separate server expected by src/lib/api/cloud.ts
```

### Responsibilities and reasons

| Layer | Current implementation | Reason/evidence |
|---|---|---|
| Static frontend | `svelte.config.js`, `src/routes/+layout.ts`, `vite.config.js`, `src-tauri/tauri.conf.json` | Static adapter with `app.html` fallback, `ssr=false`, port 1420, `frontendDist=../build`. Fits the native WebView without a Node SSR server. |
| Provider boundary | `src/lib/api/{tmdb,anilist,rawg,itunes}.ts` and matching Rust modules | Rust performs provider requests; TypeScript maps disparate payloads to shared media shapes. This keeps provider-specific fields out of most UI components. |
| Unified model | `src/lib/types/media.ts:15–77,132–133` | Six category discriminants; `MediaItem`, `MediaDetail`, `PaginatedResult<T>`, detail subtypes and filter types. Some `any`-masked contract inconsistencies remain. |
| State | `src/lib/stores/{ui,user,watchlist}.svelte.ts` | Class singletons with rune fields. User/watchlist stores choose account/persistence paths; UI store contains partly vestigial animation state. |
| Native persistence | `src-tauri/src/lib.rs:12–16`, `api/watchlist.rs:19–40` | One managed mutex-wrapped SQLite connection, users and watchlist tables initialized at app startup. This also happens when cloud mode is configured. |
| Optional cloud | `src/lib/api/cloud.ts:8–77,116–150` | Public Vite configuration selects a remote account/watchlist API; bearer token and refresh/retry logic. This extends the local design without moving media APIs to the server. |
| Visual system | `src/lib/styles/variables.scss`, `global.css`, `AppBackground.svelte` | Vite injects shared SCSS; global CSS provides tokens/utilities and film grain; CSS shapes/glows supply the current background. |

The reason column combines direct configuration evidence with architectural inference; it does not imply the original author documented every decision. Historical evidence is separated in §10.

### Resolved dependencies

From checked-in lockfiles, not manifest ranges: Svelte 5.53.7, SvelteKit 2.53.4, adapter-static 3.0.10, Vite 6.4.1, TypeScript 5.6.3, Sass 1.97.3, Tauri JS API/CLI 2.10.1; Rust Tauri 2.10.3, tauri-build 2.5.6, rusqlite 0.39.0, serde 1.0.228 and Tokio 1.50.0. The Cargo lock contains reqwest 0.12.28 and 0.13.2; the application's direct manifest dependency is the 0.12 series with JSON/rustls and default features disabled. These are not claims about the latest available releases.

## 3. Feature overview

**Status key:** Present = implementation traced, runtime unverified. Partial = implemented with identified limitations. Absent/unused = not an active feature in this snapshot. A passing build does not upgrade a feature to runtime-verified.

| ID | Feature | Implementation/evidence | Status and boundaries |
|---|---|---|---|
| FT-01 | Six-category browsing | `src/lib/components/ui/CategoryTabs.svelte:6–18`; `src/routes/+page.svelte:108–146` | Present: movie, tv, anime, manga, book, game. |
| FT-02 | Movies | `src/lib/api/tmdb.ts:95–103`; `src-tauri/src/api/tmdb.rs:19–116` | Present: popular/discover, title search, genres, details, cast and videos. Provider-error handling is incomplete. |
| FT-03 | TV series | `src/lib/api/tmdb.ts:105–112`; `src-tauri/src/api/tmdb.rs:119–217` | Present: TMDB browsing/search/genres/details; no current TVMaze fallback. |
| FT-04 | Anime | `src/lib/api/anilist.ts:130–150`; `src-tauri/src/api/anilist.rs:165–187` | Present: search/popularity, genre filter, details, characters, episode/studio metadata and available trailer. |
| FT-05 | Manga | `src/lib/api/anilist.ts:130–151`; `src-tauri/src/api/anilist.rs:190–224` | Present: shared AniList genres, search/details, author/chapters/volumes where supplied. |
| FT-06 | Games | `src/lib/api/rawg.ts:97–108`; `src-tauri/src/api/rawg.rs:19–157` | Present: discovery/search/genres, developer/publisher/platform details, screenshots; not launching/downloading games. |
| FT-07 | Books | `src/lib/api/itunes.ts:15–36,115–124`; `src-tauri/src/api/itunes.rs:19–92` | Partial: ebook search/lookup; curated keyword genres and heuristic continuation, not authoritative genre/popularity feeds. No reader or page-count data. |
| FT-08 | Unified media presentation | `src/lib/types/media.ts:18–77`; four provider mappers | Present: card/detail/pagination contracts, absolute mapped image URLs. Genre IDs and rating/count semantics need correction. |
| FT-09 | Search and feedback | `src/lib/components/ui/SearchBar.svelte:10–30`; home `245–260` | Partial: explicit submission, not live/debounced search. Clear and timed success state are disconnected from parent/result state. |
| FT-10 | Genre sidebar and cache | home `65–105,263–274,327–338`; `GenreFilter.svelte` | Present with races/fallback gap: per-category in-memory cache and vertical selection list. Search hides the filter. |
| FT-11 | Genre carousels | home `148–184`; `GenreCarousel.svelte` | Present: first eight genres, independent loading/error states, horizontal arrows, See all drilldown. No shared throttling or persistent cache. |
| FT-12 | Grid pagination/infinite scroll | home `186–221,282–302` | Partial: search/selected-genre grid, observer with 300px margin, append/retry/end states. Stale results and iTunes page-two stop remain. |
| FT-13 | Media cards | `MediaCard.svelte` | Present: lazy posters, shimmer/fallback, category/year/rating, hover metadata, detail navigation, compact watchlist menu. Interactive nesting needs remediation. |
| FT-14 | Detail page | `src/routes/media/[type]/[id]/+page.svelte:77–150,183–340` | Present: six provider branches, skeleton/error/retry, hero, metadata, genres, available trailer/cast/screenshots; stale-request and ID-validation gaps. |
| FT-15 | Trailers and cast | detail route `46–50,277–340`; TMDB/AniList mappers | Present: YouTube iframe, character/cast strip, initials fallback, mouse drag. Trailers only, not full-media streaming. |
| FT-16 | Local registration/login/profile selection | `src/routes/auth/+page.svelte`; `api/auth.ts`; Rust `auth.rs` | Partial: stored accounts, normalized email, password form, profile-email prefill. Not a secure native authorization boundary. |
| FT-17 | Persisted session/logout | `src/lib/stores/user.svelte.ts:5–27,77–91` | Partial: localStorage user projection and optional cloud tokens. No startup identity validation or complete list reset. |
| FT-18 | Root route auth guard | `src/routes/+layout.svelte:1–25` | Absent. `/auth` only redirects already-authenticated users; protected-route behavior must be designed explicitly. |
| FT-19 | Per-user watchlist CRUD/status | `api/watchlist.ts`; `stores/watchlist.svelte.ts`; Rust `watchlist.rs` | Partial: add/remove/update, exact `want / watching / watched` statuses, local/cloud paths. Identity collisions and session/request races remain. |
| FT-20 | Watchlist page/filter/counts | `src/routes/watchlist/+page.svelte:1–119` | Partial: status tabs, counts, badges and detail links; displays existing memory state, no route-entry load/guard. |
| FT-21 | Cloud accounts/watchlist | `api/cloud.ts:116–150`; user/watchlist stores | Present, server contract/runtime unverified: configuration-based account API and cloud-session-based watchlist backend. |
| FT-22 | Token refresh | `api/cloud.ts:37–77` | Partial: refresh on 401 and one retry, token clearing on failed refresh response. No single-flight coordination or full auth-state invalidation. |
| FT-23 | Offline/cloud synchronization | `api/cloud.ts:148–149` and source-wide usage scan | Unused wrapper only. No import, offline queue, conflict resolution, mirroring, periodic merge or fallback to local writes. |
| FT-24 | Animated visual background | `AppBackground.svelte`; `global.css:164–185` | Present: CSS floating shapes, radial glows, vignette and static film-grain overlay. No Canvas renderer. |
| FT-25 | Hover-hue/click pulse/detail visual modes | `stores/ui.svelte.ts`; `AppBackground.svelte`; detail `17–21` | Unwired/vestigial: pulse/hover setters have no callers; detailMode is written but not consumed. |
| FT-26 | Design/responsive/accessibility styling | `variables.scss`, `global.css`, component/route styles | Present/partial: red-black-green palette, three font families, shared tokens, breakpoints, reduced-motion/focus styles. Keyboard semantics/computed layouts untested. |
| FT-27 | Static desktop frontend | `svelte.config.js`, root layout options, Tauri config | Build verified: `build/app.html` emitted. Native package and WebView behavior not exercised. |
| FT-28 | Generic toast/modal/progress systems | `src/lib/styles/global.css` | CSS recipes only, not application services/features. Do not count selector definitions as implemented functionality. |

## 4. Backend command surface

The registration macro is `src-tauri/src/lib.rs:17–52`; module declarations are in `src-tauri/src/api/mod.rs`. Count: **29 commands**. The installed TypeScript compiler AST found **28 distinct invoked command names**, all registered; `greet` is the only registered name with no frontend service invocation. Some service methods are nevertheless unused by UI callers (§5).

For local account/watchlist handlers, Tauri supplies `State<'_, DbConn>`; callers must not send a `state` field. JavaScript top-level `userId` binds to Rust `user_id`; nested payload fields keep their declared serde names (`user_id`, `media_type`, etc.). All listed API errors use `String` rejection. Media `Value` rows mean `Result<Value, String>`.

| Command | Caller-supplied Rust parameters | Success shape / source operation | Definition |
|---|---|---|---|
| `greet` | `name: &str` | String greeting; no I/O; synchronous | `src-tauri/src/lib.rs:5–8` |
| `tmdb_discover_movies` | `page: u32, genre: Option<u32>` | Value; GET `/discover/movie` with genre, otherwise `/movie/popular` | `api/tmdb.rs:20–57` |
| `tmdb_search_movies` | `query: &str, page: u32` | Value; GET `/search/movie` | `api/tmdb.rs:76–96` |
| `tmdb_movie_details` | `id: u32` | Value; GET `/movie/{id}`, append credits/videos | `api/tmdb.rs:99–116` |
| `tmdb_genres_movies` | None | Value genre envelope; GET `/genre/movie/list` | `api/tmdb.rs:60–73` |
| `tmdb_discover_tv` | `page: u32, genre: Option<u32>` | Value; GET `/discover/tv` or `/tv/popular` | `api/tmdb.rs:120–154` |
| `tmdb_search_tv` | `query: &str, page: u32` | Value; GET `/search/tv` | `api/tmdb.rs:173–193` |
| `tmdb_tv_details` | `id: u32` | Value; GET `/tv/{id}`, append credits/videos; checks status_message | `api/tmdb.rs:196–217` |
| `tmdb_genres_tv` | None | Value genre envelope; GET `/genre/tv/list` | `api/tmdb.rs:157–170` |
| `anilist_search_anime` | `query: &str, page: u32, genre: Option<String>` | Whole GraphQL `{data:{Page:...}}` envelope; ANIME list | `api/anilist.rs:167–177` |
| `anilist_anime_details` | `id: u32` | Extracted `data.Media` Value; shared Media query | `api/anilist.rs:180–187` |
| `anilist_search_manga` | `query: &str, page: u32, genre: Option<String>` | Whole GraphQL Page envelope; MANGA list | `api/anilist.rs:191–201` |
| `anilist_manga_details` | `id: u32` | Extracted `data.Media` Value; shared Media query | `api/anilist.rs:204–211` |
| `anilist_genres` | None | Value array from `data.GenreCollection`, empty fallback | `api/anilist.rs:216–224` |
| `itunes_search` | `query: &str, page: u32, genre: Option<String>` | Raw resultCount/results Value; GET `/search`, ebook, 20/offset, keyword term | `api/itunes.rs:19–62` |
| `itunes_details` | `id: &str` | First lookup result Value or not-found rejection; GET `/lookup` | `api/itunes.rs:68–92` |
| `rawg_discover` | `page: u32, genre: Option<String>` | Synthesized results/page/total_pages/total_results Value; GET `/games`, ordering=-added | `api/rawg.rs:20–56` |
| `rawg_search` | `query: &str, page: u32, genre: Option<String>` | Same page envelope; GET `/games`, search_precise=true | `api/rawg.rs:60–97` |
| `rawg_details` | `id: u32` | Value with optional merged screenshots; concurrent `/games/{id}` and `/games/{id}/screenshots` | `api/rawg.rs:121–157` |
| `rawg_genres` | None | Raw genre envelope Value; GET `/genres`, page_size=40 | `api/rawg.rs:101–114` |
| `auth_register` | `payload: RegisterPayload` | `AuthUser`; insert normalized name/email and password hash | `api/auth.rs:67–118` |
| `auth_login` | `payload: LoginPayload` | `AuthUser`; password comparison | `api/auth.rs:121–158` |
| `auth_get_user` | `user_id: i64` | `Option<AuthUser>` | `api/auth.rs:161–184` |
| `auth_list_users` | None | `Vec<AuthUser>` sorted by name | `api/auth.rs:187–204` |
| `add_to_watchlist` | `item: WatchlistItem` | Unit/null; INSERT OR REPLACE | `api/watchlist.rs:45–52` |
| `remove_from_watchlist` | `id: String, user_id: i64` | Unit/null; DELETE by ID/user | `api/watchlist.rs:55–67` |
| `update_watchlist_status` | `id: String, user_id: i64, status: String` | Unit/null; UPDATE by ID/user | `api/watchlist.rs:70–83` |
| `get_watchlist` | `user_id: i64` | `Vec<WatchlistItem>`; no explicit ordering | `api/watchlist.rs:86–110` |
| `get_watchlist_status` | `id: String, user_id: i64` | `Option<String>` | `api/watchlist.rs:113–131` |

Definition paths beginning `api/` in this table are relative to `src-tauri/src/`.

Provider bases: `https://api.themoviedb.org/3`, `https://graphql.anilist.co`, `https://itunes.apple.com`, `https://api.rawg.io/api`. TMDB uses `pt-BR` and embedded/runtime key fallback; RAWG also needs a key. AniList checks GraphQL errors, uses 20 items/page, excludes adult list content and sorts by search relevance or popularity. Its detail query does not enforce anime versus manga type. RAWG tolerates screenshot-request failures. iTunes genres are Portuguese search keywords; `popular` is a sentinel converted to a genre or `fiction`, not a real popularity query. Provider comments about quotas/offset support were not independently live-validated.

## 5. Frontend surface

### Routes

| Route | Behavior | Important limitation |
|---|---|---|
| `/` | Category/search/genre controls; eight genre carousels or flat grid; cached genre lists; observer pagination | No request-generation protection; missing-genres fallback remains in carousel mode. |
| `/auth` | Login/register UI, local profile list, busy/error messaging, redirect when already logged in | Registration sets logged-in user while form still says to log in; Enter can resubmit during a request. |
| `/watchlist` | Filter/count current in-memory items, status controls, card navigation | No mount load, no guard, no always-visible discovery navigation when nonempty. |
| `/media/[type]/[id]` | Reactive `$page.params` detail lookup via `$effect`; back/retry/metadata/media extras | Pending previous lookup can overwrite current route; `parseInt` accepts malformed numeric prefixes. |

Root layout (`src/routes/+layout.svelte`) renders global CSS, background, UserButton and children. It has no session reconciliation. `$app/stores` remains used for route params; the application stores themselves are rune classes.

### Components and stores

| File (under `src/lib/`) | Contract / responsibility |
|---|---|
| `components/media/MediaCard.svelte` | `item`, optional `onclick`; card image/load/error state, metadata, nested compact WatchlistButton. |
| `components/ui/CategoryTabs.svelte` | `active`, `onchange`; fixed six-category list. |
| `components/ui/GenreCarousel.svelte` | `title`, `items`, `onCardClick`, optional loading/error/onSeeMore; rail and arrow state, smooth scrolling. |
| `components/ui/GenreFilter.svelte` | `genres`, `active`, `onchange`, optional loading; vertical genre menu and Todos. |
| `components/ui/SearchBar.svelte` | Optional placeholder/onSearch; owns query and timed visual feedback, not bound to parent request state. |
| `components/ui/WatchlistButton.svelte` | `item`, optional compact; membership/status from store, outside-click dismissal, add/remove/status menu. |
| `components/ui/UserButton.svelte` | No props; account/watchlist navigation and logout. |
| `components/ui/AppBackground.svelte` | No props; CSS shapes/glows/vignette; dormant pulse reaction and timer cleanup. |
| `stores/ui.svelte.ts` | Hue/intensity/click/detail fields; pulse/hover functions have no UI callers. |
| `stores/user.svelte.ts` | Persisted user, token-presence cloud flag, login/register/list/logout and busy/error state. |
| `stores/watchlist.svelte.ts` | Item array, cloud adapter, load/mutations/lookups; no automatic user-change hydration/reset. |

### Mapping and inactive surface

- TMDB converts relative images to full CDN URLs and maps cast/YouTube videos; common poster helper returns the already-normalized URL.
- AniList chooses localized titles, converts score by dividing by ten, maps characters/studios/staff/trailer and fills missing fuzzy date parts. It misuses popularity as vote count, and its detail string genre IDs contradict `Genre.id:number`.
- RAWG doubles its rating, strips description tags, maps developer/publisher/platforms/screenshots and converts playtime hours to minutes.
- iTunes maps author/artwork/year and strips description tags; passes rating through and synthesizes continuation from batch length. No populated book page count.
- `AuthAPI.getUser`, `WatchlistAPI.getStatus`, `watchlist.loadForUser`, `CloudAPI.auth.me`, the explicit `CloudAPI.auth.refresh` wrapper and `CloudAPI.watchlist.sync` have no frontend callers. Internal HTTP refresh is active. `OL_IMG` is unused; `TMDB_IMG` is active despite stale “legacy” comments. Plugin-opener is installed/registered but has no frontend use found.
- Source scans found no legacy `on:click/on:input/on:change`, no new writable/readable application stores, no manual SCSS imports in components/routes and no `{@html}`. The Google Fonts import in global CSS is legitimate and not a component-injection violation.

## 6. Data & persistence

### Local database contract

`DbConn::new("tauriflix.db")` opens a **current-working-directory-relative** file (`src-tauri/src/lib.rs:12`). It is not guaranteed to live in `src-tauri/` after installation. A mutex serializes the synchronous connection; commands use parameterized SQL. Initialization uses CREATE TABLE IF NOT EXISTS, with no schema version or migration mechanism.

| Table | Columns / constraints | Source |
|---|---|---|
| users | id INTEGER PK AUTOINCREMENT; name TEXT NOT NULL; email TEXT NOT NULL UNIQUE; password_hash TEXT NOT NULL; created_at TEXT NOT NULL default datetime('now') | `src-tauri/src/api/auth.rs:27–40` |
| watchlist | id TEXT, user_id INTEGER, media_type TEXT, title TEXT, status TEXT, added_at TEXT all NOT NULL; nullable poster TEXT; **PK(id,user_id)** | `src-tauri/src/api/watchlist.rs:21–40` |

Watchlist has no foreign key, status CHECK, provider/type component in its key or backend session check. Rust `AuthUser` returns only id/name/email, not the stored hash. Hash format is a timestamp salt followed by two formatted DefaultHasher outputs; it is not SHA-256 despite the comment and not a password KDF. Four-byte minimum password validation is weak and differs from frontend character counting.

### Session lifecycle

1. Startup parses `tauriflix_user` without schema validation and sets logged-in state if non-null; `tf_cloud_token` presence sets `isCloudUser`. No `/auth/me` or `auth_get_user` revalidation occurs.
2. Login/register/listUsers select cloud based on nonempty `VITE_CLOUD_API_URL`. Watchlist operations require both cloud configuration and cloud-user flag; otherwise they call SQLite using `Number(user.id)`.
3. Explicit login loads the watchlist; initial app restore, registration and watchlist route entry do not. Mutations reload the entire list.
4. Logout clears current user and cloud tokens when marked cloud, but not watchlist memory. Pending responses are not bound to a session generation.
5. Switching configured backend/origin can leave mismatched user IDs/tokens. The same localStorage keys are not bound to the server origin. None of this is offline synchronization.

### Cloud client contract — server unverified

The application expects these endpoints (`src/lib/api/cloud.ts:116–150`):

| Method/path | Request | Expected response |
|---|---|---|
| POST `/auth/register` | name, email, password | user + access_token + refresh_token |
| POST `/auth/login` | email, password | Same auth response |
| POST `/auth/refresh` | refresh_token | access_token + refresh_token |
| GET `/auth/me` | Bearer token | User with string id/name/email; wrapper unused |
| GET `/auth/users` | Bearer token when available | User array |
| GET `/watchlist` | Bearer token | Items including string id/user_id, media_type, title, nullable poster, status, added_at, updated_at |
| POST `/watchlist/items` | id, media_type, title, poster, status, added_at | No content expected |
| DELETE `/watchlist/items/:id` | Encoded ID | No content expected |
| PUT `/watchlist/items/:id/status` | status | No content expected |
| POST `/watchlist/sync` | `{ items: [...] }` object | Item array; wrapper unused |

The fetch helper adds JSON headers and an access token, attempts refresh on 401, then retries once. It handles non-OK errors and 204 responses. Refresh is not shared across concurrent requests; a non-OK refresh HTTP response clears tokens without fully invalidating the user store. Network rejection or refresh JSON parsing failure does not clear tokens. The cloud adapter drops updated_at, casts status and replaces user_id with unused zero.

Obsidian describes a separate Axum/PostgreSQL server, Argon2id, one-hour access tokens, rotated 30-day refresh tokens, CORS and Docker/Fly deployment. **Those implementations were not inspected.** Its status examples (`plan/watching/completed`) conflict with app `want/watching/watched`; its six-character password minimum differs from the client/local four-character policy. Its “last-write-wins” sync prose also describes destructive full-snapshot replacement. Verify server source/contracts before enabling synchronization or asserting security parity.

## 7. Build, config, and CI

- `package.json` provides dev/build/preview/check/check:watch/tauri; no lint or test script. `tsconfig.json` enables strict checking but explicit `any` still hides mapping errors.
- `vite.config.js:11–18` injects SCSS `@use 'variables' as *;`; strict dev port is 1420, conditional HMR port 1421. Do not add imports in component SCSS blocks.
- `src-tauri/build.rs:8–27` manually reads root `.env` and emits every parsed key through cargo:rustc-env; it is not a full dotenv parser. Compile-time `env!` requires both TMDB and RAWG variables to be defined. Runtime overrides do not remove that compilation requirement. Embedded keys are extractable, not confidential server secrets. Do not publish verbose build-script output.
- `src-tauri/tauri.conf.json:3–22` retains `tauri-app` product/title, `com.user.tauri-app`, 800×600, devtools=true, csp=null. CSP is not disabled only in development; the config is unconditional. Release devtools availability also depends on native build features, so this flag alone is not proof of release inspector exposure.
- `src-tauri/capabilities/default.json` grants main window `core:default` and `opener:default`. No application-command permission manifest is configured in build.rs. Capabilities are not account authorization checks.
- `ci.yml` and `release.yml` are tracked at the repository root; `.github/workflows/` is absent. CI additionally references nonexistent `npm run lint` and lacks the Linux WebKit/GTK installation found in release.yml.
- Release YAML specifies Linux/Windows/macOS builds and a **draft** release, only provisions the TMDB key (not required RAWG), and lacks explicit contents:write permission. Effective GitHub defaults and actual historical run state were not queried.
- `.allai/workspace.db` and `src-tauri/tauriflix.db` are tracked. Gitignore protects env/build outputs but not DB paths. Database contents were never read; whether they contain sensitive records is unknown.
- CONTRIBUTING and git-setup still contain template setup assumptions; `.env.example` is absent. The one-time git-setup script initializes/stages/commits/pushes and is not safe to rerun in this repository. It was not executed.

## 8. Build health and executed verification

Commands were run without pipes hiding exit status. No dependencies were installed and no production behavior was changed. Windows native tools were used explicitly after native WSL `cargo` was found absent.

| Command / scope | Actual result | What it establishes |
|---|---|---|
| `npm run check` at app root | Exit 0; `svelte-check found 0 errors and 0 warnings` | Frontend type/compiler diagnostics clean. Repeated after documentation edits with same result. |
| `npm run build` at app root | Exit 0; Vite 6.4.1; static adapter `Wrote site to "build"`; `build/app.html` exists | Static frontend assets build. Not a native installer or live app test. |
| `cargo check --locked` in src-tauri | Exit 127, cargo not found | WSL native Rust toolchain unavailable on PATH. |
| `cargo.exe --version` / `rustc.exe --version` | Cargo 1.93.1; rustc 1.93.1 | Available Windows Rust toolchain. |
| `cargo.exe check --locked` in src-tauri | Exit 0; `Finished dev profile [unoptimized + debuginfo]` | Windows native code compiles; not Linux/macOS validation. |
| `cargo.exe test --locked` | Exit 0; library, binary and doctest groups each `0 passed; 0 failed` | Test harness builds; **zero application tests**. |
| `cargo.exe clippy --locked -- -D warnings` | Exit 101; two manual_div_ceil errors at `src/api/rawg.rs:47,88` | Existing strict-lint failure, not introduced by docs. |
| `cargo.exe fmt --check` | Exit 1; formatting diff in `src-tauri/build.rs` | Existing formatting failure; no formatter mutation performed. |
| TypeScript AST invoke scan + Rust registration comparison | 28 distinct invoked, 29 registered, missing names `[]`, uncalled registered `['greet']` | Name coverage, not argument/serde/live runtime correctness. |
| Source SQL with synthetic in-memory SQLite rows | Insert movie ID 42/user 1, then TV ID 42/user 1 → only the TV row remains | Cross-type overwrite reproduced without reading or writing application data. |
| `git diff --check` | Exit 0 on documentation edits | No whitespace patch errors. |
| Skill JavaScript IPC example | Node test runner: 3 passed, 0 failed | Mock example works with installed Tauri JS API; not application coverage. |
| Skill pure Rust example | Windows rustc --test: 2 passed, 0 failed | Standalone checked arithmetic example passes, including overflow rejection. |

Not run: native GUI smoke tests, provider success/401/429 traffic, cloud deployment, password/account actions, real DB queries, desktop packaging/signing, Linux/macOS builds, visual/keyboard/accessibility interaction tests. No runtime “working” claim is made for those paths.

## 9. Documentation accuracy audit

Verdicts below describe the **pre-review** documentation. Four in-repo documents were corrected; all other documents were deliberately left unchanged. Source comments that still name Jikan/OpenLibrary/Cinemeta/TVMaze remain historical debt, not active providers.

### Repository documents — all 10 read

| Document | Verdict / action |
|---|---|
| `README.md` | Stale providers/template/missing RAWG and cloud setup. Corrected provider/category/key list and cloud-backend limitations; linked this review. |
| `CHANGELOG.md` | Missing major features and describing Canvas. Updated Unreleased to actual providers, persistence and CSS background; no invented guard or offline sync. |
| `CONTRIBUTING.md` | Partly stale: placeholder clone URL, absent env example, old provider sample, provider-wiring and automatic-release claims. Left as backlog. |
| `.github/copilot-instructions.md` | Mostly accurate conventions, but oversimplified typed commands/module registration and omitted cloud-fetch path. Corrected. Contrary to the plan, this file originally had no provider list or gold palette to replace. |
| `.github/agents/tauriflix.agent.md` | Wrong provider/palette/background claims and overbroad async/JSON/IPC rules. Corrected while preserving model field and established component conventions. |
| `.github/instructions/scss-autoinjection.instructions.md` | Mechanism and identifiers accurate. `--clr-gold` is a legacy name with a red value. No change. |
| `.github/prompts/scaffold-api.prompt.md` | Media-provider scaffold is coherent, including module/handler distinction; could add Rust validation and explicit follow-on category wiring. No change. |
| `ci.yml` | Intended quality gates only; inactive path, missing lint script and native Linux prerequisites. No change. |
| `release.yml` | Intended draft-release workflow only; inactive path, incomplete key/permissions setup. No change. |
| `git-setup.sh` | Non-idempotent one-time template with staging/commit/push actions and placeholder origin. Read only; do not rerun as setup. |

### Obsidian notes — all 8 read in full, none edited

Vault root supplied by user: `../obisidian-journal/Programming/Tauri_APP/`. The reference directory was accessible for read-only inspection; it remains outside the application repository.

#### `API Reference.md`
- Useful provider/service/command reference; API inventory sums to 28 handlers plus scaffold greet in code.
- Incorrectly describes AniList Page unwrapping and RAWG genre reduction at the Rust boundary; actual list envelope and frontend mapping differ.
- Confuses numeric `Genre.id` with mixed `GenreOption.id`; overstates image/rating normalization and safe offline hashing.
- Cloud schema/security/rate-limit statements are documentation claims, not runtime evidence.

#### `Architecture.md`
- Mostly current SPA/IPC/SQLite/cloud topology and build references; cloud URL is a Vite dev/build input, not runtime OS configuration.
- All-commands-JSON and sample store/mapper names drift; local typed results and cloud-fetch exception matter.
- Click/detail animation wiring and registration/login flow are overstated; code does not match every diagram.
- CSP is unconditional null, not dev-only; cloud security details require separate server verification.

#### `Cloud Server.md`
- Documents companion Axum/PostgreSQL layout, endpoints, migrations, auth tokens, setup and deployment; server not inspected.
- Status values and password minimum conflict with app contracts; successful registration still calls cloud user enumeration.
- Sync prose mixes last-write-wins with full snapshot replacement; client wrapper is unused.
- Backlog explicitly includes enumeration, revocation, rate limits, CORS and local hashing. No destructive setup or API examples were executed.

#### `Component Patterns.md`
- Component prop tables broadly match all eight components and home/carousel structure.
- Search feedback is timed, card watchlist action is not hover-only, pulse wiring is absent, carousel arrows use state rather than derived runes.
- Detail loads via reactive effect; watchlist button moved to hero; books do not populate page count.
- Described root guard and registration return-to-login behavior do not exist as stated.

#### `Config and Stack.md`
- Generally useful manifests/scripts/SPA/SCSS/native dependency guide; actual rusqlite is 0.39.0, not 0.32.
- Correct SCSS path is css.preprocessorOptions.scss.additionalData; “runes replace stores” is a project preference, not a framework requirement.
- Cloud/backend selection does not mean offline sync; embedded keys are not secrets from binary inspection.
- Environment/Linux/Postgres instructions are untested guidance; absent `.env.example` makes copy instruction fail.

#### `Design System.md`
- Main palette/font/spacing/radius/motion tables match both token layers.
- Gold/Canvas narrative is stale; preserve legacy symbol names while describing their actual red values.
- CSS background z=0, content z=1 and grain z=4 match current rules; old comments are not runtime evidence.
- Some hardcoded old colors/status colors remain outside shared tokens; no recoloring was performed.

#### `Learning roadmap.md`
- Learning sequence covers Web, SCSS, TypeScript, Svelte, Vite, Rust, Tauri, IPC and Git/CI.
- Sections 1/5/6/7/9 have `[ x ]` or `[ X ]` annotations; 2/8 unmarked, 3/4 highlighted but unmarked. These indicate personal study progress, not verified features or mastery.
- Old function names/line references and vscode-file editor-shell links reduce portability.
- Recommended next learning: typed contracts/tests, native authorization, migrations, concurrency and explicit sync semantics.

#### `Front-end/SvelteKit Special Pages.md`
- Four-route inventory and SPA/home/detail/status layout mostly match.
- Root guard and automatic watchlist route hydration claims are incorrect.
- Detail data uses `$effect`; detailMode has no renderer consumer and page-count data is null.
- Registration auto-login conflicts with stated return-to-login flow; server constraints remain unverified.

These notes contain valuable API contracts, prop tables, persistence schemas and learning context missing from original in-repo docs, but are not automatically more authoritative than implementation. Future vault edits require separate authorization.

## 10. History and rationale

History was read locally using `git log --all`, first-parent history, targeted show/stat/diff, and the removed TVMaze module. The chronology below belongs to the reviewed ancestry. Later branch refs include other auth/Google/Docker work but do not establish features in this checkout. No fetch, merge, history rewrite or remote CI query was performed.

| Commit/date | Verified implementation change | Reason and confidence |
|---|---|---|
| `1acd324`, 2026-03-06 | Scaffold already contains Tauri/SvelteKit, TMDB, preliminary Jikan/OpenLibrary native modules, media card/search/background, stores and styles | Foundation for desktop media discovery; structural inference from introduced files, not a detailed design decision record. |
| `6107b58`, 2026-03-06 | SearchBar responsive change in the reviewed history | Message states responsive fix; no claim of exhaustive responsive QA. |
| `0e0358d`, 2026-03-26 | Adds media detail route, cast/trailer structures and TMDB detail mapping; adjusts navigation/background | Message explicitly names detail/trailer/cast; expands from catalog cards into detail browsing. |
| `b37325f`, 2026-03-27 | Changes palette, card/search/background/styles and detail trailer presentation | Explicit Netflix UI overhaul; explains current red/black tokens and older lingering gold identifiers. |
| `5b1411b`, 2026-03-31 | Completes Jikan/OpenLibrary frontend services, category tabs, unified extras and detail dispatch | Explicit multi-API integration; reuse of MediaItem/MediaDetail avoids a separate UI per source (architectural inference). These are historical providers, not current ones. |
| `490c80e`, 2026-03-31 | Background component rewrite | Visual iteration documented only by terse message; no performance rationale asserted. |
| `2d930df`, 2026-04-30 | Removes TMDB modules/services, introduces TVMaze, removes movie tab; TVMaze adapts search/index/detail to common shape | TVMaze source explicitly notes keyless public API, no true popular endpoint and non-paginated search. Avoiding a key is plausible motivation, but original intent beyond the message is not documented. |
| `3e40cda`, 2026-04-30 | Removes TVMaze/Jikan/OpenLibrary; restores TMDB and movies, adds AniList/iTunes/RAWG and games, genres/carousels/filter dispatch | Restores movie support and richer category discovery; actual diff confirms replacement. Home comments explain an eight-carousel cap to constrain request volume; provider popularity sorting supplies discover behavior. No upstream availability/reliability comparison was proven. |
| `834f59d`, 2026-04-30 | Another background rewrite, yielding current CSS shape/glow design | Visual update established by source; no documented reason for abandoning prior visuals beyond message. |
| `042dd06`, 2026-04-30 | Adds rusqlite, local auth/watchlist commands/services, user store, auth/watchlist routes and buttons | Explicit auth/watchlist/user-DB change; per-user persistence replaces the earlier simple list model. It does not establish a root guard or strong native authorization. |
| `eb3f1bf`, 2026-05-02 | Adds cloud.ts, token/session fields and configured cloud branches in user/watchlist stores, adjusts auth UI | Explicit server connection logic; preserves local fallback when unconfigured. Adds remote CRUD selection, not a synchronization engine. |

**TVMaze question resolved:** it was removed by `3e40cda` and replaced with restored TMDB modules/registration. It is not a current fallback, hidden integration or file requiring deletion. Leftover comments and helper names should not be mistaken for live implementation.

## 11. Findings and backlog

Severity is review prioritization, not an assertion of a live exploit. Unless marked corrected, findings remain open because this execution intentionally changes documentation only. Fixes should be separate, narrowly scoped TDD work with migrations/behavior decisions reviewed first.

### F-01 — Local password hashing is not a password KDF (HIGH)
**Evidence:** `src-tauri/src/api/auth.rs:42–64,80–99`. Two fast DefaultHasher operations and timestamp salt are described incorrectly as SHA-256 and sufficient offline. Formatted output length does not supply password-hardening properties.
**Impact / next validation:** offline guessing risk if DB exposed; use vetted Argon2id with random salts and an explicit migration/reset strategy. Test legacy verification/migration and malformed hashes before rollout. Do not claim companion-server Argon2 parity without reading it.

### F-02 — Local commands trust caller-selected account identity (HIGH)
**Evidence:** `src-tauri/src/api/watchlist.rs:44–131`, `auth.rs:160–204`; `src/lib/stores/user.svelte.ts:7–27`.
**Impact / next validation:** frontend code can select arbitrary local user_id; persisted user JSON is not authentication. Define the desktop threat model and backend principal/session checks, then test cross-user read/write denial. A route guard alone is insufficient.

### F-03 — Watchlist identity collides across media types (HIGH, isolated reproduction)
**Evidence:** Rust `watchlist.rs:28–48`; frontend `stores/watchlist.svelte.ts:85–91`, `api/watchlist.ts:18–39`, cloud path `api/cloud.ts:143–146`.
**Reproduction:** extracted source CREATE TABLE and INSERT OR REPLACE statements, executed only against SQLite `:memory:`. Synthetic movie `(id='42', user_id=1)` followed by TV with the same key left one TV row. No real catalog records or DB files used.
**Impact / next validation:** saved entries overwrite and UI membership/status/removal can target the wrong category. Use provider/type/id plus user identity end to end and a migration. Cloud schema behavior remains unverified, although client routes also omit namespace.

### F-04 — Missing watchlist/session hydration and reset (HIGH)
**Evidence:** `stores/watchlist.svelte.ts:23–46`, `stores/user.svelte.ts:77–82`, auth route `75–77`, root layout and watchlist route.
**Impact / next validation:** persisted login can show empty saved list after restart; logout/registration can retain prior user's memory list; unguarded watchlist route renders it. Pending old-user loads can republish data. Add session-keyed initialization, synchronous clear and request-generation checks; test restore/logout/register/account-switch with delayed requests.

### F-05 — Cloud token refresh is not session-coordinated (HIGH)
**Evidence:** `api/cloud.ts:37–77`, `stores/user.svelte.ts:24–27,77–82`.
**Impact / next validation:** concurrent 401s can race refresh rotation; a non-OK refresh HTTP response clears tokens but leaves UI logged in, whereas network/JSON failures leave tokens intact; refresh finishing after logout can save tokens again. Share refresh work, bind it to session generation and invalidate complete auth state. Separate unauthenticated login errors from authenticated refresh handling. Test simultaneous 401s/logout/refresh failure.

### F-06 — Databases are tracked in Git (HIGH risk; contents unknown)
**Evidence:** baseline `git ls-files` includes `.allai/workspace.db`, `src-tauri/tauriflix.db`; `.gitignore` has no database exclusions.
**Impact / next validation:** potential private data and binary churn. Contents were not inspected; no claim that secrets are present. Decide what to remove/ignore and whether history/privacy remediation is warranted with user approval. Do not rewrite history automatically.

### F-07 — Grid, genres and detail requests can publish stale results (MEDIUM–HIGH)
**Evidence:** home `85–105,152–181,187–221,224–274`; detail route `77–150`.
**Impact / next validation:** a second search can update headers while loadGrid returns early; old page appends can contaminate new results; category checks do not cover A→B→A; detail response can overwrite a newer route. Capture immutable request context, use generations/abort where available, and guard loading/error/continuation writes. Test delayed out-of-order resolutions.

### F-08 — Genre failure fallback stays in carousel mode (MEDIUM)
**Evidence:** home `59,100–102,230–233,357–385`.
**Impact / next validation:** loadGrid("") fetches data but leaves isSearch=false/activeGenre=null, so carouselMode remains true and grid/error is hidden. Add an explicit fallback mode and retry state; test failed/empty genre response with successful discovery.

### F-09 — iTunes pagination stops after page two (MEDIUM)
**Evidence:** `api/itunes.ts:80–90`; home `60,195–198,207–215`.
**Impact / next validation:** a full first batch advertises two pages; loadMore does not update res.total_pages, so page two's continuation is ignored. Update continuation per page or model hasNextPage explicitly. Test three full synthetic batches and final short batch; independently confirm upstream offset support.

### F-10 — HTTP/provider errors are inconsistently surfaced (MEDIUM)
**Evidence:** Rust `tmdb.rs:47–56,109–115` versus `212–215`; `rawg.rs:33–55,77–96`; frontend mappers.
**Impact / next validation:** JSON error envelopes can appear as empty lists or invalid details. Add consistent HTTP status/timeout and provider-envelope validation; preserve partial screenshot tolerance intentionally. Test 401/404/429/5xx, non-JSON and missing required fields using mocks. Avoid exposing credential-bearing request URLs in error logs.

### F-11 — Native data validation/migrations/error handling incomplete (MEDIUM)
**Evidence:** `watchlist.rs:21–40,45–50,70–108`; `auth.rs:85–92,187–202`; `lib.rs:12`.
**Impact / next validation:** no enum/FK/session checks, relative DB path, no versioned migrations, poisoned mutex unwraps and silently dropped row decode errors. Define app-data storage and transactional migration; test invalid status, missing user, schema upgrades and query errors. Keep SQL parameterization.

### F-12 — Cloud storage/backend identity and transport risks (MEDIUM)
**Evidence:** `cloud.ts:8–24,38–55,118`, user/watchlist store branches.
**Impact / next validation:** tokens in localStorage are exposed to compromised frontend script; URL need not be HTTPS; origin/backend changes reuse storage and may mismatch IDs or send tokens to a different configured origin. Validate deployment URL, scope session storage and reauthenticate on backend change; evaluate native secret storage within the threat model. No existing XSS was demonstrated.

### F-13 — Root-level workflows are inactive and incomplete (MEDIUM)
**Evidence:** `ci.yml:19–37`, `release.yml:30–49`, `package.json:6–13`, no `.github/workflows` entries.
**Impact / next validation:** intended automated gates/releases do not run from these paths. Move only in a dedicated change with lint script decision, Linux native dependencies, both build keys and explicit release permissions; verify CI runs. Draft releases are not automatically published. Historical CI activity was not established.

### F-14 — No application tests; existing strict native checks fail (MEDIUM)
**Evidence:** tracked source test scan, manifest, actual §8 results; `rawg.rs:47,88` and build.rs formatting.
**Impact / next validation:** successful check/build has no behavioral safety net. Start with provider mapping/IPC/session/identity regression tests; fix Clippy and formatting separately without bundling unrelated refactors. Do not install an arbitrary latest Vitest incompatible with Vite 6.

### F-15 — CSP and packaging defaults need a release decision (MEDIUM)
**Evidence:** `tauri.conf.json:3–22`, default capability file, `src/app.html:2,7`.
**Impact / next validation:** null CSP offers no policy defense; template identity/title and English document language remain; development inspector flag requires release-feature review. Define product identity and least-privilege policy, then test images/fonts/YouTube/cloud requests and denied native operations in the target WebView. Do not paste permissive wildcard CSP.

### F-16 — Registration flow and auth submission races (MEDIUM)
**Evidence:** user store `31–45`; auth route `8–13,62–136` and input key handlers.
**Impact / next validation:** register sets currentUser and triggers redirect while form says “Faça login”; explicit login can navigate before list load error is visible. Disabled buttons do not prevent repeated Enter handlers. Choose coherent auto-login, centralize hydration and guard submissions; test double Enter and failed post-login load.

### F-17 — Search feedback and clear are not connected to real state (MEDIUM)
**Evidence:** `SearchBar.svelte:10–30`; home `245–260,314–317`.
**Impact / next validation:** clear resets only input; parent Discover reset does not clear child; spinner/success timers ignore request outcome and lack destruction cleanup. Use controlled query and real async status; test clearing, failure and navigation during requests.

### F-18 — Card/menu keyboard semantics and mutation errors (MEDIUM)
**Evidence:** `MediaCard.svelte:26,108–124`; `WatchlistButton.svelte:41–57,69–137`; auth/watchlist tabs.
**Impact / next validation:** real buttons nest inside card button; extra keyboard wrapper prevents default without activation; menus lack complete focus/Escape/arrow handling; mutations have no busy/error UI. Separate navigation/action elements and test keyboard/focus, duplicate clicks and rejected operations in a WebView.

### F-19 — DTO and metric normalization inconsistencies (LOW–MEDIUM)
**Evidence:** `media.ts:46,132–133`; `anilist.ts:57,97–110`; `itunes.ts:72–73,103–104`; `rawg.ts:19–20`; watchlist cloud adapter `7–18`.
**Impact / next validation:** string detail genres violate declared numeric type; popularity is labeled reviews; iTunes rating not converted like other providers; unchecked cloud status/type can yield undefined labels. Replace weak `any` assumptions with validated fixture contracts and honest metric labels/scales.

### F-20 — Remaining visual/maintenance debt (LOW–MEDIUM)
**Evidence:** global.css `809–831,1598–1600`; home scoped sidebar `437–477`; GenreCarousel arrow styles; UI store and AppBackground.
**Impact / next validation:** shared `.sidebar` recipes may leak properties, responsive max-width remains constrained, arrows don't respond to resize, reused card image error state isn't reset; old gold effects/dead helpers/animation state persist. Computed-style effects were not runtime-tested. Namespace deliberately, test resize/prop updates, and remove dead code only in separate scoped work.

### F-21 — Four primary docs contradicted implementation (CORRECTED)
**Evidence/action:** README, CHANGELOG, copilot instructions and TauriFlix agent now describe actual providers, palette, typed/local/cloud boundaries and CSS animation. Preserved agent model and component conventions. No nonexistent root guard/sync/canvas feature was added to documentation.

### F-22 — Other docs and companion contracts still drift (OPEN, LOW–MEDIUM)
**Evidence:** §9 inventory; CONTRIBUTING/setup examples, source comments and vault notes.
**Impact / next validation:** stale guard/sync/hash/provider claims can cause regressions. Reconcile vault only with authorization, and verify server status/password/refresh/sync contracts against its source before implementation. Keep learning checkmarks distinct from shipped functionality.

### Recommended sequence for follow-up work

1. Define account/native trust boundary; migrate password hashing and composite watchlist identity with tests/data-safety plan.
2. Correct user/watchlist lifecycle and cloud refresh/session races; add delayed-response regressions.
3. Add mapping/error/pagination tests; fix grid/detail request generations and fallback behavior.
4. Enable real CI, fix baseline lint/formatting, review CSP/packaging and validate a native smoke path.
5. Decide cloud synchronization semantics with the server before implementing bulk sync; then reconcile remaining docs and UI/a11y debt.

No step above was implemented during this documentation review.

## 12. Specialized skill delivered

A user-local Hermes skill named `tauri-svelte-rust` was created through the skill manager in the active default profile:

`/home/kanoah/.hermes/skills/software-development/tauri-svelte-rust/SKILL.md`

It includes `references/testing.md` (complete no-network IPC and pure-Rust examples) and `references/tauriflix.md` (project conventions and review caveats). Frontmatter is valid; its description is 53 characters. The JavaScript example passed 3 tests with the installed Tauri API; the pure Rust example passed 2 Windows tests. These are skill-example tests, **not application tests**. The skill is user-local and is not included in this Git repository's commits.

The original plan's proposed skill was corrected rather than copied verbatim: no fake API/identity mapper, no claim that Svelte stores are invalid, no claim that native network handlers cannot be unit-tested, no unconditional crypto replacement, and no conflation of missing module compilation errors with missing handler runtime errors. It distinguishes project-specific no-import/onMount rules from framework capabilities.

Official research consulted on 2026-09-14:

- [Tauri SvelteKit integration](https://v2.tauri.app/start/frontend/sveltekit/): SPA recommended, SSG supported, prerender-time native API limitation; fallback/port examples are not mandatory values.
- [Calling Rust](https://v2.tauri.app/develop/calling-rust/): serializable commands/results, argument naming and registration.
- [Capabilities](https://v2.tauri.app/security/capabilities/): auto-enabled files versus explicit selection, application command defaults, AppManifest and security boundaries.
- [Mocking](https://v2.tauri.app/develop/tests/mocking/): mockIPC/clearMocks and version-sensitive event mocking; mocks do not exercise the native boundary.
- [Tauri 1 migration](https://v2.tauri.app/start/migrate/from-tauri-1/): v2 config/API/plugin differences.
- [Svelte state](https://svelte.dev/docs/svelte/$state) and [stores](https://svelte.dev/docs/svelte/stores): official pages were unavailable to the extractor; read equivalent official [state source](https://raw.githubusercontent.com/sveltejs/svelte/main/documentation/docs/02-runes/02-%24state.md) and [store source](https://raw.githubusercontent.com/sveltejs/svelte/main/documentation/docs/06-runtime/01-stores.md). Stores remain useful for asynchronous streams/manual subscription control.
- [Hermes skills documentation source](https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/user-guide/features/skills.md): consulted when the official documentation site could not be extracted. Active tool validation was also used.

## Appendix A — Full source-read inventory

Every path below was read in full during the review, including long style blocks. Source line citations elsewhere refer to unchanged application files at the snapshot. All 37 paths were reconciled programmatically against `git ls-files`.

```text
src-tauri/src/api/anilist.rs
src-tauri/src/api/auth.rs
src-tauri/src/api/itunes.rs
src-tauri/src/api/mod.rs
src-tauri/src/api/rawg.rs
src-tauri/src/api/tmdb.rs
src-tauri/src/api/watchlist.rs
src-tauri/src/lib.rs
src-tauri/src/main.rs
src/app.html
src/lib/api/anilist.ts
src/lib/api/auth.ts
src/lib/api/cloud.ts
src/lib/api/itunes.ts
src/lib/api/rawg.ts
src/lib/api/tmdb.ts
src/lib/api/watchlist.ts
src/lib/components/media/MediaCard.svelte
src/lib/components/ui/AppBackground.svelte
src/lib/components/ui/CategoryTabs.svelte
src/lib/components/ui/GenreCarousel.svelte
src/lib/components/ui/GenreFilter.svelte
src/lib/components/ui/SearchBar.svelte
src/lib/components/ui/UserButton.svelte
src/lib/components/ui/WatchlistButton.svelte
src/lib/stores/ui.svelte.ts
src/lib/stores/user.svelte.ts
src/lib/stores/watchlist.svelte.ts
src/lib/styles/global.css
src/lib/styles/variables.scss
src/lib/types/media.ts
src/routes/+layout.svelte
src/routes/+layout.ts
src/routes/+page.svelte
src/routes/auth/+page.svelte
src/routes/media/[type]/[id]/+page.svelte
src/routes/watchlist/+page.svelte
```

Additional full reads: `package.json`, `svelte.config.js`, `vite.config.js`, `tsconfig.json`, `.gitignore`, `.vscode/extensions.json`, `src-tauri/.gitignore`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, the 10 repository docs/scripts and 8 vault notes in §9. Relevant dependency entries were parsed from package-lock.json and Cargo.lock. Binary artwork/databases, credentials and generated artifacts were not counted as reviewed source documentation.

## Appendix B — Execution scope and deviations from plan

- Created the planned review branch from the actual detached snapshot; retained the pre-existing `.hermes/` plan, added a supersession notice and tracked it as the optional plan-record commit.
- Treated planned “verified facts” as hypotheses and corrected them against source, including command count, guard, background, sync and historical CI claims.
- Used official Hermes delegation/tools available in this session, not the plan's nonexistent `subagent-driven-development` skill.
- Kept review scratch notes outside the repository, so no temporary docs file needed deletion. The final report retains inventory, feature, documentation and finding coverage.
- Used available Windows cargo.exe/rustc.exe rather than installing a WSL toolchain. Recorded target-specific validation and pre-existing lint/format failures without source fixes.
- Added no application test framework or dependencies in a docs-only task. Validated the skill examples separately and used isolated synthetic SQL to reproduce the identity flaw.
- Did not modify vault/server, activate workflows, untrack databases, migrate credentials, launch the app, publish a release, push commits or rewrite history. Those require separately scoped follow-up work.
