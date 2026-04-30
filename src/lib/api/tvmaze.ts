// ================================================================
// TauriFlix — TVmaze Service
//
// TVmaze is a free, keyless TV-shows API. We map its responses into
// the same shared MediaItem / MediaDetail types used by other providers.
// Image URLs are absolute (no path prefixing required).
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, PaginatedResult } from '$lib/types/media';

interface RawPage { results: any[]; page: number; total_pages: number; total_results: number; }

// Strip simple HTML tags from TVmaze summaries (they ship as small HTML snippets).
function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').trim();
}

// Hash a string into a stable numeric ID for genre pills (TVmaze uses string genres).
function genreId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Map a raw TVmaze show into our shared MediaItem.
function map(raw: any): MediaItem {
  return {
    id:             raw.id,
    title:          raw.name ?? 'Sem título',
    overview:       stripHtml(raw.summary),
    poster_path:    raw.image?.original ?? raw.image?.medium ?? null,
    backdrop_path:  raw.image?.original ?? null,
    vote_average:   raw.rating?.average ?? 0,
    vote_count:     0, // TVmaze doesn't expose vote counts
    first_air_date: raw.premiered ?? undefined,
    genre_ids:      Array.isArray(raw.genres) ? raw.genres.map((g: string) => genreId(g)) : [],
    media_type:     'tv',
  };
}

function mapPage(raw: RawPage): PaginatedResult<MediaItem> {
  return {
    results:       (raw.results ?? []).map(map),
    page:          raw.page          ?? 1,
    total_pages:   raw.total_pages   ?? 1,
    total_results: raw.total_results ?? 0,
  };
}

// Map a raw TVmaze show (with embedded cast) into our MediaDetail.
function mapDetail(raw: any): MediaDetail {
  const cast = (raw._embedded?.cast ?? []).slice(0, 20).map((c: any) => ({
    id:           c.person?.id ?? 0,
    name:         c.person?.name ?? '',
    character:    c.character?.name ?? '',
    profile_path: c.person?.image?.medium ?? c.person?.image?.original ?? null,
  }));

  const episodes = raw._embedded?.episodes?.length ?? null;
  const runtime = raw.runtime ?? raw.averageRuntime ?? null;
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g: string) => ({ id: genreId(g), name: g }))
    : [];

  return {
    id:            raw.id,
    media_type:    'tv',
    title:         raw.name ?? 'Sem título',
    tagline:       raw.network?.name ?? raw.webChannel?.name ?? '',
    overview:      stripHtml(raw.summary),
    poster_path:   raw.image?.original ?? raw.image?.medium ?? null,
    backdrop_path: raw.image?.original ?? null,
    vote_average:  raw.rating?.average ?? 0,
    vote_count:    0,
    release_date:  raw.premiered ?? '',
    runtime,
    genres,
    cast,
    videos:        [], // TVmaze does not provide trailers
    episodes,
    status:        raw.status ?? undefined,
  };
}

export const TvmazeAPI = {
  // Search TV shows by text query (TVmaze returns all matches at once).
  searchShows: (query: string, page = 1) =>
    invoke<RawPage>('tvmaze_search_shows', { query, page }).then(mapPage),

  // Discover popular shows (sorted by weight, paginated 250-by-ID).
  discoverShows: (page = 1) =>
    invoke<RawPage>('tvmaze_discover_shows', { page }).then(mapPage),

  // Full show details (cast + episode count).
  showDetails: (id: number): Promise<MediaDetail> =>
    invoke<any>('tvmaze_show_details', { id }).then(mapDetail),
};
