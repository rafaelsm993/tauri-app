# TauriFlix — SvelteKit Special Pages

> SvelteKit file conventions and the two routes in the app.

## File conventions

| File | Role | Present |
| --- | --- | --- |
| `+page.svelte` | Page component for a route | `/`, `/media/[type]/[id]` |
| `+layout.svelte` | Wraps all child pages | `src/routes/+layout.svelte` |
| `+layout.ts` | Layout options/load; sets `ssr = false` | `src/routes/+layout.ts` |
| `+error.svelte` | Error boundary | not present (SvelteKit default) |
| `+page.server.ts` / `+server.ts` | Server-only code | never — there is no server |

The `+` prefix marks a file SvelteKit treats specially. Plain components and modules live in `src/lib/`.

## SPA mode (`+layout.ts`)

```typescript
export const ssr = false;
```

Tauri loads a static bundle from disk, so there is no Node server to render pages. Setting `ssr = false` together with `adapter-static({ fallback: "app.html" })` makes SvelteKit a client-only SPA.

## Root layout (`+layout.svelte`)

The root layout does three things: it imports `global.css`, renders `<AppBackground />`, and wraps the page in `<div class="app-content">`. It has no nav, no auth check and no redirects.

---

## Home (`/`) — `src/routes/+page.svelte`

```
┌──────────────────────────────────────────────┐
│  SearchBar                CategoryTabs       │
├──────────┬───────────────────────────────────┤
│ Gêneros  │  context line (+ reset link)      │
│ (Genre   │  GenreCarousel × up to 8          │
│  Filter, │   — or —                          │
│  hidden  │  MediaCard grid + sentinel        │
│  during  │                                   │
│  search) │                                   │
└──────────┴───────────────────────────────────┘
```

### Modes

`carouselMode = !isSearch && activeGenre === null`

| Mode | Trigger | Shows |
| --- | --- | --- |
| Carousel | default | One `GenreCarousel` per genre, capped at `MAX_CAROUSELS = 8` |
| Grid | search query | flat grid with infinite scroll; genre cleared |
| Grid | genre selected | flat grid with infinite scroll |
| Grid (fallback) | category has no genres | `loadGrid("")` |

### Data flow

1. `onMount` calls `refreshView()`. In carousel mode that runs `refreshGenres(cat)` and then `loadCarousels(cat, list)`.
2. `loadCarousels` fetches page 1 for each genre in parallel with `Promise.allSettled`, so one failing genre (for example a 429) doesn't block the others. Results are dropped if `activeCategory` has changed in the meantime.
3. `switchCategory(cat)` resets `activeGenre` (genre ids differ between providers) and then refreshes.
4. `switchGenre(id)` sets the genre and refreshes, which switches to grid mode.
5. `onSearch(q)` clears the genre and calls `loadGrid(q)`. `clearSearch()` (the "← Descobrir" link) resets search.
6. `fetchPage(cat, q, p, genre)` is the single switch that dispatches to the right provider.
   - Books with no query send `"popular"`, which the Rust side turns into `"fiction"`.
   - TMDB search ignores the genre.
7. In grid mode, infinite scroll (`IntersectionObserver`, 300px margin) calls `loadMore()`.

### Genre cache

`genreCache: Partial<Record<MediaType, GenreOption[]>>` keeps each category's genre list for the page's lifetime, so switching back to a tab needs no new request. Book genres are hardcoded and never hit IPC.

---

## Detail (`/media/[type]/[id]`) — `src/routes/media/[type]/[id]/+page.svelte`

The params come from `page` in `$app/stores`. An `$effect` runs `fetchDetail(type, id)` whenever they change.

```typescript
switch (type) {
  case 'movie': detail = await TmdbAPI.movieDetails(parseInt(id));   break;
  case 'tv':    detail = await TmdbAPI.tvDetails(parseInt(id));      break;
  case 'anime': detail = await AnilistAPI.animeDetails(parseInt(id)); break;
  case 'manga': detail = await AnilistAPI.mangaDetails(parseInt(id)); break;
  case 'book':  detail = await ITunesAPI.bookDetails(decodeURIComponent(id)); break;
  case 'game':  detail = await RawgAPI.gameDetails(parseInt(id));    break;
  default: error = 'Tipo de mídia inválido.';
}
```

A non-numeric id for a numeric provider shows `ID inválido.`

### Sections

| Section | Notes |
| --- | --- |
| Loading | Skeleton for the hero, poster and text lines |
| Error | Message + "Tentar novamente" + "← Voltar" |
| Hero | Backdrop, fade, "← Voltar" (`goto('/')`), title, tagline |
| Poster | `poster_path`, or a "Sem poster" placeholder |
| Meta badges | ★ rating, year, runtime `Xh Ym` (books would show `N páginas`, but runtime is always null for books), episodes, chapters, volumes, status, platforms |
| Credits line | developer · publisher (games), otherwise studios; author |
| Genres | pill row |
| Overview | `detail.overview` |
| Trailer | YouTube `<iframe>`: first `type === 'Trailer'`, otherwise the first video |
| Capturas | Game screenshots, horizontal scroll |
| Elenco | Cast row with drag-to-scroll; initials when there is no photo |

The page sets `ui.detailMode = true` on creation and resets it in `onDestroy`.
