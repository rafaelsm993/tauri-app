// ================================================================
// TauriFlix — Jikan Service (Anime + Manga)
//
// Wraps Tauri invoke calls to the Rust Jikan API.
// Maps raw Jikan v4 responses into shared MediaItem / MediaDetail.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, PaginatedResult } from '$lib/types/media';

// ── Raw Jikan envelope ────────────────────────────────────────
interface RawJikanPage {
  data: any[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: { count: number; total: number; per_page: number };
  };
}

interface RawJikanDetail {
  data: any;
}

// ── Mappers ───────────────────────────────────────────────────

function mapAnime(raw: any): MediaItem {
  return {
    id:           raw.mal_id,
    title:        raw.title_english || raw.title || 'Sem título',
    overview:     raw.synopsis ?? '',
    poster_path:  raw.images?.jpg?.large_image_url ?? raw.images?.jpg?.image_url ?? null,
    backdrop_path: null,
    vote_average: raw.score ?? 0,
    vote_count:   raw.scored_by ?? 0,
    release_date: raw.aired?.from?.slice(0, 10),
    media_type:   'anime',
    episodes:     raw.episodes ?? null,
  };
}

function mapManga(raw: any): MediaItem {
  return {
    id:           raw.mal_id,
    title:        raw.title_english || raw.title || 'Sem título',
    overview:     raw.synopsis ?? '',
    poster_path:  raw.images?.jpg?.large_image_url ?? raw.images?.jpg?.image_url ?? null,
    backdrop_path: null,
    vote_average: raw.score ?? 0,
    vote_count:   raw.scored_by ?? 0,
    release_date: raw.published?.from?.slice(0, 10),
    media_type:   'manga',
    chapters:     raw.chapters ?? null,
  };
}

function mapAnimePage(raw: RawJikanPage): PaginatedResult<MediaItem> {
  return {
    results:       (raw.data ?? []).map(mapAnime),
    page:          raw.pagination?.current_page ?? 1,
    total_pages:   raw.pagination?.last_visible_page ?? 1,
    total_results: raw.pagination?.items?.total ?? 0,
  };
}

function mapMangaPage(raw: RawJikanPage): PaginatedResult<MediaItem> {
  return {
    results:       (raw.data ?? []).map(mapManga),
    page:          raw.pagination?.current_page ?? 1,
    total_pages:   raw.pagination?.last_visible_page ?? 1,
    total_results: raw.pagination?.items?.total ?? 0,
  };
}

function mapAnimeDetail(raw: RawJikanDetail): MediaDetail {
  const d = raw.data;
  return {
    id:           d.mal_id,
    media_type:   'anime',
    title:        d.title_english || d.title || 'Sem título',
    tagline:      '',
    overview:     d.synopsis ?? '',
    poster_path:  d.images?.jpg?.large_image_url ?? null,
    backdrop_path: null,
    vote_average: d.score ?? 0,
    vote_count:   d.scored_by ?? 0,
    release_date: d.aired?.from?.slice(0, 10) ?? '',
    runtime:      null,
    genres:       (d.genres ?? []).map((g: any) => ({ id: g.mal_id, name: g.name })),
    cast:         [],
    videos:       d.trailer?.youtube_id
      ? [{ key: d.trailer.youtube_id, site: 'YouTube', type: 'Trailer', name: 'Trailer' }]
      : [],
    episodes:     d.episodes ?? null,
    status:       d.status ?? '',
    studios:      (d.studios ?? []).map((s: any) => s.name),
  };
}

function mapMangaDetail(raw: RawJikanDetail): MediaDetail {
  const d = raw.data;
  return {
    id:           d.mal_id,
    media_type:   'manga',
    title:        d.title_english || d.title || 'Sem título',
    tagline:      '',
    overview:     d.synopsis ?? '',
    poster_path:  d.images?.jpg?.large_image_url ?? null,
    backdrop_path: null,
    vote_average: d.score ?? 0,
    vote_count:   d.scored_by ?? 0,
    release_date: d.published?.from?.slice(0, 10) ?? '',
    runtime:      null,
    genres:       (d.genres ?? []).map((g: any) => ({ id: g.mal_id, name: g.name })),
    cast:         [],
    videos:       [],
    chapters:     d.chapters ?? null,
    volumes:      d.volumes ?? null,
    status:       d.status ?? '',
    author:       (d.authors ?? []).map((a: any) => a.name).join(', '),
  };
}

// ── Public API ────────────────────────────────────────────────

export const JikanAPI = {
  searchAnime: (query: string, page = 1) =>
    invoke<RawJikanPage>('search_anime', { query, page }).then(mapAnimePage),

  searchManga: (query: string, page = 1) =>
    invoke<RawJikanPage>('search_manga', { query, page }).then(mapMangaPage),

  animeDetails: (id: number): Promise<MediaDetail> =>
    invoke<RawJikanDetail>('anime_details', { id }).then(mapAnimeDetail),

  mangaDetails: (id: number): Promise<MediaDetail> =>
    invoke<RawJikanDetail>('manga_details', { id }).then(mapMangaDetail),
};
