// ================================================================
// TauriFlix — TMDB Service
//
// All Tauri invoke calls live here. If you add Jikan or OpenLibrary
// later, copy this pattern: each service exposes search() + discover()
// and maps its raw response into the shared MediaItem / PaginatedResult.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, PaginatedResult } from '$lib/types/media';

// Raw TMDB envelope from Rust (serde_json::Value → JS object)
interface RawPage { results: any[]; page: number; total_pages: number; total_results: number; }

// Map a raw TMDB movie/tv object into our shared MediaItem
function map(raw: any, type: 'movie' | 'tv'): MediaItem {
  return {
    id:            raw.id,
    title:         raw.title ?? raw.name ?? 'Sem título',
    overview:      raw.overview ?? '',
    poster_path:   raw.poster_path   ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    vote_average:  raw.vote_average  ?? 0,
    vote_count:    raw.vote_count    ?? 0,
    release_date:  raw.release_date,
    first_air_date:raw.first_air_date,
    genre_ids:     raw.genre_ids,
    media_type:    type,
  };
}

function mapPage(raw: RawPage, type: 'movie' | 'tv'): PaginatedResult<MediaItem> {
  return {
    results:       (raw.results ?? []).map(r => map(r, type)),
    page:          raw.page          ?? 1,
    total_pages:   Math.min(raw.total_pages ?? 1, 500), // TMDB hard cap
    total_results: raw.total_results ?? 0,
  };
}

export const TmdbAPI = {
  // Search movies by text query
  searchMovies: (query: string, page = 1) =>
    invoke<RawPage>('search_movies', { query, page }).then(r => mapPage(r, 'movie')),

  // Search TV series by text query
  searchSeries: (query: string, page = 1) =>
    invoke<RawPage>('search_series', { query, page }).then(r => mapPage(r, 'tv')),

  // Discover popular movies (no query)
  discoverMovies: (page = 1) =>
    invoke<RawPage>('discover_movies', { page }).then(r => mapPage(r, 'movie')),

  // Discover popular series (no query)
  discoverSeries: (page = 1) =>
    invoke<RawPage>('discover_series', { page }).then(r => mapPage(r, 'tv')),

  // Full movie details (videos + credits appended)
  movieDetails: (id: number) => invoke<any>('movie_details', { id }),

  // Full series details
  seriesDetails: (id: number) => invoke<any>('series_details', { id }),
};