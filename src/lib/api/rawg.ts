// ================================================================
// TauriFlix — RAWG Service (Games)
//
// RAWG covers ~870k games across all platforms (Steam, Epic, Riot, mobile,
// retro consoles). Image URLs are absolute, hosted on media.rawg.io.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, PaginatedResult, GenreOption } from '$lib/types/media';

interface RawPage { results: any[]; page: number; total_pages: number; total_results: number; }

// Strip HTML tags from descriptions (RAWG ships <p>, <br>, etc.).
function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function map(raw: any): MediaItem {
  // RAWG `rating` is on a 0–5 scale; double it to match other providers' 0–10.
  const rating = raw.rating ? +(raw.rating * 2).toFixed(1) : 0;
  const year = (raw.released ?? '').slice(0, 4);
  return {
    id:            raw.id,
    title:         raw.name ?? 'Sem título',
    overview:      '', // not returned in list endpoints
    poster_path:   raw.background_image ?? null,
    backdrop_path: raw.background_image ?? null,
    vote_average:  rating,
    vote_count:    raw.ratings_count ?? 0,
    release_date:  year || undefined,
    media_type:    'game',
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

function mapDetail(raw: any): MediaDetail {
  const rating = raw.rating ? +(raw.rating * 2).toFixed(1) : 0;
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g: any) => ({ id: g.id, name: g.name ?? '' }))
    : [];

  // Dedupe platforms by name (RAWG returns sub-versions like "PS4" + "PS5").
  const platformSet = new Set<string>();
  if (Array.isArray(raw.platforms)) {
    for (const p of raw.platforms) {
      const name = p?.platform?.name;
      if (name) platformSet.add(name);
    }
  }

  const screenshots = Array.isArray(raw.screenshots)
    ? raw.screenshots.map((s: any) => s.image).filter(Boolean)
    : [];

  return {
    id:            raw.id,
    media_type:    'game',
    title:         raw.name ?? 'Sem título',
    tagline:       Array.isArray(raw.developers) && raw.developers.length
      ? raw.developers.map((d: any) => d.name).join(', ')
      : '',
    overview:      stripHtml(raw.description ?? raw.description_raw),
    poster_path:   raw.background_image ?? null,
    backdrop_path: raw.background_image_additional ?? raw.background_image ?? null,
    vote_average:  rating,
    vote_count:    raw.ratings_count ?? 0,
    release_date:  raw.released ?? '',
    runtime:       raw.playtime ? raw.playtime * 60 : null, // hours → minutes
    genres,
    cast:          [],
    videos:        [],
    status:        raw.tba ? 'Em breve' : undefined,
    developer:     Array.isArray(raw.developers) ? raw.developers.map((d: any) => d.name).join(', ') : '',
    publisher:     Array.isArray(raw.publishers) ? raw.publishers.map((p: any) => p.name).join(', ') : '',
    platforms:     [...platformSet],
    screenshots,
    studios:       Array.isArray(raw.developers) ? raw.developers.map((d: any) => d.name) : [],
  };
}

// RAWG `genres` endpoint returns paginated { count, results: [{ id, slug, name }] }.
// We pass the slug back to discover/search for cleaner URLs.
interface RawRawgGenres { results: { id: number; slug: string; name: string }[] }

function mapRawgGenres(raw: RawRawgGenres): GenreOption[] {
  return (raw.results ?? []).map(g => ({ id: g.slug, name: g.name }));
}

export const RawgAPI = {
  discoverGames: (page = 1, genre?: string) =>
    invoke<RawPage>('rawg_discover', { page, genre: genre ?? null }).then(mapPage),

  searchGames: (query: string, page = 1, genre?: string) =>
    invoke<RawPage>('rawg_search', { query, page, genre: genre ?? null }).then(mapPage),

  gameDetails: (id: number): Promise<MediaDetail> =>
    invoke<any>('rawg_details', { id }).then(mapDetail),

  genres: (): Promise<GenreOption[]> =>
    invoke<RawRawgGenres>('rawg_genres').then(mapRawgGenres),
};
