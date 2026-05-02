// ================================================================
// TauriFlix — AniList Service (Anime + Manga)
//
// AniList is GraphQL-based; the Rust backend issues the actual HTTP POST
// and returns the unwrapped GraphQL `data.Page` / `data.Media` payloads.
// AniList shares the same `GenreCollection` for anime and manga, so both
// service methods point at the same underlying command.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, PaginatedResult, GenreOption, MediaType } from '$lib/types/media';

interface RawAnilistPage {
  data: {
    Page: {
      pageInfo: { total: number; currentPage: number; lastPage: number; hasNextPage: boolean; perPage: number };
      media: any[];
    };
  };
}

// Pick the most appropriate localised title.
function pickTitle(title: any): string {
  if (!title) return 'Sem título';
  return title.userPreferred || title.english || title.romaji || title.native || 'Sem título';
}

function pickPoster(cover: any): string | null {
  if (!cover) return null;
  return cover.extraLarge || cover.large || cover.medium || null;
}

function fuzzyDate(d: any): string {
  if (!d || !d.year) return '';
  const m = String(d.month ?? 1).padStart(2, '0');
  const day = String(d.day ?? 1).padStart(2, '0');
  return `${d.year}-${m}-${day}`;
}

// AniList scores are 0-100; convert to the 0-10 scale used elsewhere.
function score10(s: number | null | undefined): number {
  return typeof s === 'number' && s > 0 ? +(s / 10).toFixed(1) : 0;
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function mapMedia(raw: any, mt: MediaType): MediaItem {
  return {
    id:            raw.id,
    title:         pickTitle(raw.title),
    overview:      stripHtml(raw.description),
    poster_path:   pickPoster(raw.coverImage),
    backdrop_path: raw.bannerImage ?? null,
    vote_average:  score10(raw.averageScore),
    vote_count:    raw.popularity ?? 0,
    release_date:  fuzzyDate(raw.startDate),
    media_type:    mt,
    episodes:      mt === 'anime' ? (raw.episodes ?? null) : undefined,
    chapters:      mt === 'manga' ? (raw.chapters ?? null) : undefined,
  };
}

function mapPage(raw: RawAnilistPage, mt: MediaType): PaginatedResult<MediaItem> {
  const p = raw?.data?.Page;
  const list = p?.media ?? [];
  return {
    results:       list.map(m => mapMedia(m, mt)),
    page:          p?.pageInfo?.currentPage ?? 1,
    total_pages:   p?.pageInfo?.lastPage ?? 1,
    total_results: p?.pageInfo?.total ?? list.length,
  };
}

function mapDetail(raw: any, mt: MediaType): MediaDetail {
  const cast = (raw.characters?.edges ?? []).slice(0, 20).map((e: any) => ({
    id:           e.node?.id ?? 0,
    name:         e.node?.name?.full ?? '',
    character:    e.role ? String(e.role).replace('_', ' ').toLowerCase() : '',
    profile_path: e.node?.image?.large ?? e.node?.image?.medium ?? null,
  }));

  const studios = Array.isArray(raw.studios?.nodes)
    ? raw.studios.nodes.map((s: any) => s.name).filter(Boolean)
    : [];
  const author = (raw.staff?.edges ?? [])
    .filter((e: any) => /story|art|original/i.test(e.role ?? ''))
    .map((e: any) => e.node?.name?.full)
    .filter(Boolean)
    .join(', ');

  const videos = raw.trailer?.id && raw.trailer?.site === 'youtube'
    ? [{ key: raw.trailer.id, site: 'YouTube', type: 'Trailer', name: 'Trailer' }]
    : [];

  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g: string) => ({ id: g, name: g }))
    : [];

  return {
    id:            raw.id,
    media_type:    mt,
    title:         pickTitle(raw.title),
    tagline:       '',
    overview:      stripHtml(raw.description),
    poster_path:   pickPoster(raw.coverImage),
    backdrop_path: raw.bannerImage ?? null,
    vote_average:  score10(raw.averageScore ?? raw.meanScore),
    vote_count:    raw.popularity ?? 0,
    release_date:  fuzzyDate(raw.startDate),
    runtime:       raw.duration ?? null,
    genres,
    cast,
    videos,
    episodes:      mt === 'anime' ? (raw.episodes ?? null) : undefined,
    chapters:      mt === 'manga' ? (raw.chapters ?? null) : undefined,
    volumes:       mt === 'manga' ? (raw.volumes ?? null) : undefined,
    status:        raw.status ?? '',
    studios,
    author:        mt === 'manga' ? author : undefined,
  };
}

// Genres are returned as a flat string array shared across anime and manga.
function mapGenres(raw: string[]): GenreOption[] {
  return (raw ?? []).map(name => ({ id: name, name }));
}

export const AnilistAPI = {
  searchAnime: (query: string, page = 1, genre?: string) =>
    invoke<RawAnilistPage>('anilist_search_anime', { query, page, genre: genre ?? null })
      .then(r => mapPage(r, 'anime')),

  searchManga: (query: string, page = 1, genre?: string) =>
    invoke<RawAnilistPage>('anilist_search_manga', { query, page, genre: genre ?? null })
      .then(r => mapPage(r, 'manga')),

  animeDetails: (id: number): Promise<MediaDetail> =>
    invoke<any>('anilist_anime_details', { id }).then(r => mapDetail(r, 'anime')),

  mangaDetails: (id: number): Promise<MediaDetail> =>
    invoke<any>('anilist_manga_details', { id }).then(r => mapDetail(r, 'manga')),

  animeGenres: (): Promise<GenreOption[]> =>
    invoke<string[]>('anilist_genres').then(mapGenres),

  // Same underlying GenreCollection for both — exposed twice to keep the
  // home page's per-category genre cache trivial.
  mangaGenres: (): Promise<GenreOption[]> =>
    invoke<string[]>('anilist_genres').then(mapGenres),
};
