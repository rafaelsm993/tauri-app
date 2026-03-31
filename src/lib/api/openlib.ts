// ================================================================
// TauriFlix — OpenLibrary Service (Books)
//
// Wraps Tauri invoke calls to the Rust OpenLibrary API.
// Maps raw OpenLibrary responses into shared MediaItem / MediaDetail.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, PaginatedResult } from '$lib/types/media';
import { OL_IMG } from '$lib/types/media';

// ── Raw OpenLibrary envelope ──────────────────────────────────
interface RawSearchResult {
  docs: any[];
  numFound: number;
  start: number;
}

// ── Mappers ───────────────────────────────────────────────────

function mapBook(raw: any): MediaItem {
  return {
    id:           raw.key,  // e.g. "/works/OL27448W"
    title:        raw.title ?? 'Sem título',
    overview:     '',       // search results don't include description
    poster_path:  OL_IMG.cover(raw.cover_i ?? null, 'M'),
    backdrop_path: null,
    vote_average: raw.ratings_average ?? 0,
    vote_count:   0,
    release_date: raw.first_publish_year ? `${raw.first_publish_year}` : undefined,
    media_type:   'book',
    author:       (raw.author_name ?? []).join(', '),
  };
}

function mapSearchPage(raw: RawSearchResult, page: number): PaginatedResult<MediaItem> {
  const perPage = 20;
  return {
    results:       (raw.docs ?? []).map(mapBook),
    page,
    total_pages:   Math.ceil((raw.numFound ?? 0) / perPage),
    total_results: raw.numFound ?? 0,
  };
}

function mapBookDetail(raw: any, key: string): MediaDetail {
  // description can be a string or { type, value } object
  const desc = typeof raw.description === 'string'
    ? raw.description
    : raw.description?.value ?? '';

  return {
    id:           key,
    media_type:   'book',
    title:        raw.title ?? 'Sem título',
    tagline:      '',
    overview:     desc,
    poster_path:  raw.covers?.[0] ? OL_IMG.cover(raw.covers[0], 'L') : null,
    backdrop_path: null,
    vote_average: 0,
    vote_count:   0,
    release_date: raw.first_publish_date ?? '',
    runtime:      null,
    genres:       [],
    cast:         [],
    videos:       [],
    subjects:     (raw.subjects ?? []).slice(0, 10),
    author:       (raw.authors ?? []).map((a: any) => a.author?.key ?? '').join(', '),
  };
}

// ── Public API ────────────────────────────────────────────────

export const OpenLibraryAPI = {
  searchBooks: (query: string, page = 1) =>
    invoke<RawSearchResult>('search_books', { query, page }).then(r => mapSearchPage(r, page)),

  bookDetails: (key: string): Promise<MediaDetail> =>
    invoke<any>('book_details', { key }).then(r => mapBookDetail(r, key)),
};
