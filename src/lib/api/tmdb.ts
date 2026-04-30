// ================================================================
// TauriFlix — TMDB Service (Movies + TV Series)
//
// TMDB returns RELATIVE poster/backdrop paths — frontend prepends the
// official image CDN via TMDB_IMG. All other providers store absolute URLs.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, MediaType, PaginatedResult, GenreOption } from '$lib/types/media';
import { TMDB_IMG } from '$lib/types/media';

interface RawPage { results: any[]; page: number; total_pages: number; total_results: number; }

function mapMovie(raw: any): MediaItem {
  return {
    id:            raw.id,
    title:         raw.title ?? raw.original_title ?? 'Sem título',
    overview:      raw.overview ?? '',
    poster_path:   TMDB_IMG.poster(raw.poster_path),
    backdrop_path: TMDB_IMG.backdrop(raw.backdrop_path),
    vote_average:  raw.vote_average ?? 0,
    vote_count:    raw.vote_count ?? 0,
    release_date:  raw.release_date ?? undefined,
    genre_ids:     raw.genre_ids ?? [],
    media_type:    'movie',
  };
}

function mapTv(raw: any): MediaItem {
  return {
    id:             raw.id,
    title:          raw.name ?? raw.original_name ?? 'Sem título',
    overview:       raw.overview ?? '',
    poster_path:    TMDB_IMG.poster(raw.poster_path),
    backdrop_path:  TMDB_IMG.backdrop(raw.backdrop_path),
    vote_average:   raw.vote_average ?? 0,
    vote_count:     raw.vote_count ?? 0,
    first_air_date: raw.first_air_date ?? undefined,
    genre_ids:      raw.genre_ids ?? [],
    media_type:     'tv',
  };
}

function mapPage<T>(raw: RawPage, mapFn: (r: any) => T): PaginatedResult<T> {
  return {
    results:       (raw.results ?? []).map(mapFn),
    page:          raw.page          ?? 1,
    total_pages:   raw.total_pages   ?? 1,
    total_results: raw.total_results ?? 0,
  };
}

function mapDetail(raw: any, mt: MediaType): MediaDetail {
  const cast = (raw.credits?.cast ?? []).slice(0, 20).map((c: any) => ({
    id:           c.id,
    name:         c.name ?? '',
    character:    c.character ?? '',
    profile_path: TMDB_IMG.profile(c.profile_path),
  }));

  const videos = (raw.videos?.results ?? [])
    .filter((v: any) => v.site === 'YouTube')
    .map((v: any) => ({ key: v.key, site: v.site, type: v.type, name: v.name }));

  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g: any) => ({ id: g.id, name: g.name }))
    : [];

  return {
    id:            raw.id,
    media_type:    mt,
    title:         raw.title ?? raw.name ?? 'Sem título',
    tagline:       raw.tagline ?? '',
    overview:      raw.overview ?? '',
    poster_path:   TMDB_IMG.poster(raw.poster_path, 'w500'),
    backdrop_path: TMDB_IMG.backdrop(raw.backdrop_path, 'w1280'),
    vote_average:  raw.vote_average ?? 0,
    vote_count:    raw.vote_count ?? 0,
    release_date:  raw.release_date ?? raw.first_air_date ?? '',
    runtime:       raw.runtime ?? raw.episode_run_time?.[0] ?? null,
    genres,
    cast,
    videos,
    episodes:      raw.number_of_episodes ?? null,
    status:        raw.status ?? undefined,
    studios:       (raw.production_companies ?? []).map((c: any) => c.name).filter(Boolean),
  };
}

interface RawGenreList { genres: { id: number; name: string }[] }

function mapGenres(raw: RawGenreList): GenreOption[] {
  return (raw.genres ?? []).map(g => ({ id: g.id, name: g.name }));
}

export const TmdbAPI = {
  discoverMovies: (page = 1, genre?: number) =>
    invoke<RawPage>('tmdb_discover_movies', { page, genre: genre ?? null }).then(r => mapPage(r, mapMovie)),
  searchMovies: (query: string, page = 1) =>
    invoke<RawPage>('tmdb_search_movies', { query, page }).then(r => mapPage(r, mapMovie)),
  movieDetails: (id: number): Promise<MediaDetail> =>
    invoke<any>('tmdb_movie_details', { id }).then(r => mapDetail(r, 'movie')),
  movieGenres: (): Promise<GenreOption[]> =>
    invoke<RawGenreList>('tmdb_genres_movies').then(mapGenres),

  discoverTv: (page = 1, genre?: number) =>
    invoke<RawPage>('tmdb_discover_tv', { page, genre: genre ?? null }).then(r => mapPage(r, mapTv)),
  searchTv: (query: string, page = 1) =>
    invoke<RawPage>('tmdb_search_tv', { query, page }).then(r => mapPage(r, mapTv)),
  tvDetails: (id: number): Promise<MediaDetail> =>
    invoke<any>('tmdb_tv_details', { id }).then(r => mapDetail(r, 'tv')),
  tvGenres: (): Promise<GenreOption[]> =>
    invoke<RawGenreList>('tmdb_genres_tv').then(mapGenres),
};
