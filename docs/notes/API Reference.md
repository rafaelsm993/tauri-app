# TauriFlix — API Reference

> Every Tauri command, the frontend service that calls it, and the shared types they map into.

## Overview

All data comes from four third-party APIs. The Rust backend calls them through `reqwest`, and the frontend calls the Rust backend through `invoke()`.

Every Rust command follows the same pattern:

- It is an `async fn` returning `Result<serde_json::Value, String>` and passes the provider's JSON through with little or no change.
- Errors become strings via `.map_err(|e| e.to_string())`. The frontend receives them as a rejected promise carrying a string.
- It is registered in `src-tauri/src/lib.rs` inside `tauri::generate_handler![]`, and its module is declared in `src-tauri/src/api/mod.rs`.

Each `src/lib/api/<provider>.ts` wraps the `invoke()` calls and maps the raw JSON into `MediaItem`, `MediaDetail` and `GenreOption`. Command arguments are passed as camelCase-compatible objects (`{ query, page, genre }`), and an absent genre is sent as `null`.

---

## TMDB — movies and TV

- Base: `https://api.themoviedb.org/3`
- Auth: `api_key` query param (`TMDB_API_KEY`)
- Language: `pt-BR`

### Rust (`src-tauri/src/api/tmdb.rs`)

| Command | Params | Endpoint |
| --- | --- | --- |
| `tmdb_discover_movies` | `page: u32, genre: Option<u32>` | `/movie/popular`; with a genre, `/discover/movie?with_genres=…&sort_by=popularity.desc` |
| `tmdb_search_movies` | `query: &str, page: u32` | `/search/movie` |
| `tmdb_movie_details` | `id: u32` | `/movie/{id}?append_to_response=credits,videos` |
| `tmdb_genres_movies` | — | `/genre/movie/list` |
| `tmdb_discover_tv` | `page: u32, genre: Option<u32>` | `/tv/popular` or `/discover/tv` |
| `tmdb_search_tv` | `query: &str, page: u32` | `/search/tv` |
| `tmdb_tv_details` | `id: u32` | `/tv/{id}?append_to_response=credits,videos` |
| `tmdb_genres_tv` | — | `/genre/tv/list` |

### Frontend (`src/lib/api/tmdb.ts`)

```typescript
TmdbAPI.discoverMovies(page = 1, genre?: number) → PaginatedResult<MediaItem>
TmdbAPI.searchMovies(query, page = 1)             → PaginatedResult<MediaItem>
TmdbAPI.movieDetails(id: number)                  → MediaDetail
TmdbAPI.movieGenres()                             → GenreOption[]
TmdbAPI.discoverTv / searchTv / tvDetails / tvGenres   // same shapes
```

Mapping notes:

- TMDB returns relative image paths. The mappers turn them into absolute URLs with `TMDB_IMG` (`poster` w342, or w500 on detail; `backdrop` w780, or w1280 on detail; `profile` w185). After mapping, every provider stores absolute URLs.
- Search does not accept a genre. The home page drops the genre when a query is present.
- Detail: cast is the first 20 of `credits.cast`; videos are filtered to YouTube only; `runtime` comes from `runtime` or `episode_run_time[0]`; `episodes` from `number_of_episodes`; `studios` from `production_companies`.

---

## AniList — anime and manga

- Endpoint: `https://graphql.anilist.co` (GraphQL POST)
- Auth: none. Rate limit is about 90 requests/min.

### Rust (`src-tauri/src/api/anilist.rs`)

| Command | Params | Query |
| --- | --- | --- |
| `anilist_search_anime` | `query: &str, page: u32, genre: Option<String>` | `Page(perPage: 20) { media(type: ANIME, isAdult: false) }` |
| `anilist_search_manga` | same | same with `type: MANGA` |
| `anilist_anime_details` | `id: u32` | `Media(id)` — returns `data.Media` |
| `anilist_manga_details` | `id: u32` | `Media(id)` — returns `data.Media` |
| `anilist_genres` | — | `GenreCollection` — returns a string array |

Lists sort by `SEARCH_MATCH` when a query is given and by `POPULARITY_DESC` otherwise, which makes the empty query the "discover" view. List commands return the full `{ data: { Page } }` envelope; detail commands return the unwrapped `Media`.

### Frontend (`src/lib/api/anilist.ts`)

```typescript
AnilistAPI.searchAnime(query, page = 1, genre?: string) → PaginatedResult<MediaItem>
AnilistAPI.searchManga(query, page = 1, genre?: string) → PaginatedResult<MediaItem>
AnilistAPI.animeDetails(id: number) / mangaDetails(id)  → MediaDetail
AnilistAPI.animeGenres() / mangaGenres()                 → GenreOption[]   // same command
```

Mapping notes:

- Scores run 0–100 and are divided by 10.
- Descriptions have their HTML stripped.
- Title priority: `userPreferred` → `english` → `romaji` → `native`.
- Genre ids are the genre names (strings).
- `episodes` is set for anime; `chapters` and `volumes` for manga.
- For manga, `author` comes from staff whose role matches story/art/original.
- The trailer is used only when it is hosted on YouTube.

---

## RAWG — games

- Base: `https://api.rawg.io/api`
- Auth: `key` query param (`RAWG_API_KEY`)

### Rust (`src-tauri/src/api/rawg.rs`)

| Command | Params | Endpoint |
| --- | --- | --- |
| `rawg_discover` | `page: u32, genre: Option<String>` | `/games?ordering=-added&page_size=20` |
| `rawg_search` | `query: &str, page: u32, genre: Option<String>` | `/games?search=…&search_precise=true&page_size=20` |
| `rawg_details` | `id: u32` | `/games/{id}` and `/games/{id}/screenshots` in parallel (`tokio::join!`), merged |
| `rawg_genres` | — | `/genres?page_size=40` |

### Frontend (`src/lib/api/rawg.ts`)

```typescript
RawgAPI.discoverGames(page = 1, genre?: string)       → PaginatedResult<MediaItem>
RawgAPI.searchGames(query, page = 1, genre?: string)  → PaginatedResult<MediaItem>
RawgAPI.gameDetails(id: number)                       → MediaDetail
RawgAPI.genres()                                      → GenreOption[]   // id = slug
```

Mapping notes:

- Ratings run 0–5 and are doubled.
- `runtime` is `playtime` hours × 60.
- `platforms` has duplicates removed by name.
- `developer`, `publisher`, `screenshots` and `studios` are filled in.
- List items have no overview.

---

## iTunes Search — books (ebooks)

- Base: `https://itunes.apple.com`
- Auth: none

### Rust (`src-tauri/src/api/itunes.rs`)

| Command | Params | Endpoint |
| --- | --- | --- |
| `itunes_search` | `query: &str, page: u32, genre: Option<String>` | `/search?media=ebook&limit=20&offset=(page-1)*20` |
| `itunes_details` | `id: &str` | `/lookup?id=…` (first result) |

iTunes ignores `genreId` for ebooks, so the genre keyword is folded into `term` instead:

| Query | Genre | Resulting `term` |
| --- | --- | --- |
| text | keyword | `"<query> <keyword>"` |
| text | none | `"<query>"` |
| empty or `popular` | keyword | `"<keyword>"` |
| empty or `popular` | none | `"fiction"` |

### Frontend (`src/lib/api/itunes.ts`)

```typescript
ITunesAPI.searchBooks(query, page = 1, genre?: string) → PaginatedResult<MediaItem>
ITunesAPI.bookDetails(id: string)                      → MediaDetail
ITunesAPI.genres()                                     → GenreOption[]   // hardcoded, no IPC
```

- The 20 hardcoded genre keywords (in Portuguese) are: romance, fantasia, ficção científica, mistério, suspense, terror, aventura, drama, biografia, história, autoajuda, negócios, filosofia, religião, culinária, infantil, jovem adulto, quadrinhos, poesia, tecnologia.
- `id` is `String(trackId)`. Covers are upscaled by URL substitution (600px in lists, 1200px on detail).
- There is no total count, so `total_pages = page + 1` while a page comes back full (20 items).
- `runtime` is always `null` (no page count).

---

## Shared types (`src/lib/types/media.ts`)

```typescript
type MediaType = 'movie' | 'tv' | 'anime' | 'manga' | 'book' | 'game';

interface PaginatedResult<T> { results: T[]; page: number; total_pages: number; total_results: number; }

interface MediaItem {
  id: number | string;            // string for iTunes
  title: string; overview: string;
  poster_path: string | null;     // absolute URL after mapping (all providers)
  backdrop_path: string | null;
  vote_average: number;           // normalised to 0–10
  vote_count: number;
  release_date?: string; first_air_date?: string; genre_ids?: number[];
  media_type: MediaType;
  author?: string; episodes?: number | null; chapters?: number | null; developer?: string;
}

interface MediaDetail {
  id: number | string; media_type: MediaType;
  title: string; tagline: string; overview: string;
  poster_path: string | null; backdrop_path: string | null;
  vote_average: number; vote_count: number; release_date: string;
  runtime: number | null;         // minutes
  genres: Genre[]; cast: CastMember[]; videos: VideoClip[];
  author?; episodes?; chapters?; volumes?; status?; studios?; subjects?;
  developer?; publisher?; platforms?; screenshots?;
}

interface Genre       { id: number; name: string; }   // declared number; AniList/iTunes actually put strings or hashes here
interface CastMember  { id: number; name: string; character: string; profile_path: string | null; }
interface VideoClip   { key: string; site: string; type: string; name: string; }
type GenreId = number | string;                     // number for TMDB, string for AniList/RAWG/iTunes
interface GenreOption { id: GenreId; name: string; }
```

Helpers:

- `TMDB_IMG.poster/backdrop/profile(path, size)`
- `getPosterUrl(item)` returns `item.poster_path`.
- `getYear(item)` takes the first 4 characters of `release_date` or `first_air_date`.
- `getRating(item)` returns `vote_average.toFixed(1)`, or `''` when it is 0.
- `MEDIA_LABELS` holds the pt-BR category labels.
- `GENRE_SUPPORTED` contains all 6 types.
- `OL_IMG` (OpenLibrary covers) is legacy and has no callers.

---

## Adding a new provider

1. Create `src-tauri/src/api/<provider>.rs` with `#[tauri::command] pub async fn …` returning `Result<Value, String>`.
2. Add `pub mod <provider>;` to `src-tauri/src/api/mod.rs`.
3. Register each command in `generate_handler![]` in `src-tauri/src/lib.rs`.
4. Create `src/lib/api/<provider>.ts` that invokes the commands and maps the results to `MediaItem` / `MediaDetail` / `GenreOption`.
5. If it is a new category, add it to `MediaType`, `MEDIA_LABELS`, `GENRE_SUPPORTED` and `CategoryTabs`.
6. Wire it into the `loadGenresFor()` and `fetchPage()` switches in `src/routes/+page.svelte`, and into `fetchDetail()` in `src/routes/media/[type]/[id]/+page.svelte`.
