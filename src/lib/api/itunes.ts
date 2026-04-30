// ================================================================
// TauriFlix — iTunes Search Service (ebooks)
//
// iTunes Search API is keyless and unrestricted in practice. Books are
// fetched as `media=ebook`. Cover artwork is provided as a 100×100 thumb
// which we upscale via URL substitution.
// ================================================================
import { invoke } from '@tauri-apps/api/core';
import type { MediaItem, MediaDetail, PaginatedResult, GenreOption } from '$lib/types/media';

// Apple Books has no public genre-list endpoint and silently ignores the
// `genreId` query param for ebook searches. The only way to narrow by genre
// is to fold a Portuguese keyword into the search `term` itself. Each entry
// pairs a friendly display name with the keyword we send to iTunes.
const ITUNES_BOOK_GENRES: GenreOption[] = [
  { id: 'romance',         name: 'Romance' },
  { id: 'fantasia',        name: 'Fantasia' },
  { id: 'ficção científica', name: 'Ficção Científica' },
  { id: 'mistério',        name: 'Mistério' },
  { id: 'suspense',        name: 'Suspense' },
  { id: 'terror',          name: 'Terror' },
  { id: 'aventura',        name: 'Aventura' },
  { id: 'drama',           name: 'Drama' },
  { id: 'biografia',       name: 'Biografia' },
  { id: 'história',        name: 'História' },
  { id: 'autoajuda',       name: 'Autoajuda' },
  { id: 'negócios',        name: 'Negócios' },
  { id: 'filosofia',       name: 'Filosofia' },
  { id: 'religião',        name: 'Religião' },
  { id: 'culinária',       name: 'Culinária' },
  { id: 'infantil',        name: 'Infantil' },
  { id: 'jovem adulto',    name: 'Jovem Adulto' },
  { id: 'quadrinhos',      name: 'Quadrinhos' },
  { id: 'poesia',          name: 'Poesia' },
  { id: 'tecnologia',      name: 'Tecnologia' },
];

interface RawSearchResult {
  resultCount: number;
  results: any[];
}

const PAGE_SIZE = 20;

// iTunes thumb URLs end in `/100x100bb.jpg`. Swap for a higher resolution.
function upscaleCover(url: string | undefined | null, size = 600): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb(-\d+)?\.(jpg|png)$/i, `/${size}x${size}bb.jpg`);
}

// Strip simple HTML from descriptions (iTunes ships <br/>, <i>, etc.).
function stripHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').trim();
}

// Stable hash for genre pill ids (iTunes provides genreIds but they're huge).
function genreId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function map(raw: any): MediaItem {
  const year = (raw.releaseDate ?? '').slice(0, 4);
  return {
    id:            String(raw.trackId),
    title:         raw.trackName ?? raw.trackCensoredName ?? 'Sem título',
    overview:      stripHtml(raw.description),
    poster_path:   upscaleCover(raw.artworkUrl100 ?? raw.artworkUrl60, 600),
    backdrop_path: null,
    vote_average:  raw.averageUserRating ?? 0,
    vote_count:    raw.userRatingCount ?? 0,
    release_date:  year || undefined,
    media_type:    'book',
    author:        raw.artistName ?? '',
  };
}

function mapPage(raw: RawSearchResult, page: number): PaginatedResult<MediaItem> {
  const items = raw.results ?? [];
  // iTunes does not return a global total. We advertise +1 page while the
  // current page is full, so the infinite scroller can keep going.
  const hasMore = items.length >= PAGE_SIZE;
  return {
    results:       items.map(map),
    page,
    total_pages:   hasMore ? page + 1 : page,
    total_results: raw.resultCount ?? items.length,
  };
}

function mapDetail(raw: any): MediaDetail {
  const genres = Array.isArray(raw.genres) ? raw.genres : [];
  return {
    id:            String(raw.trackId),
    media_type:    'book',
    title:         raw.trackName ?? raw.trackCensoredName ?? 'Sem título',
    tagline:       raw.artistName ?? '',
    overview:      stripHtml(raw.description),
    poster_path:   upscaleCover(raw.artworkUrl100 ?? raw.artworkUrl60, 1200),
    backdrop_path: null,
    vote_average:  raw.averageUserRating ?? 0,
    vote_count:    raw.userRatingCount ?? 0,
    release_date:  raw.releaseDate ?? '',
    runtime:       null, // iTunes ebooks don't expose a reliable page count
    genres:        genres.map((g: string) => ({ id: genreId(g), name: g })),
    cast:          [],
    videos:        [],
    subjects:      genres,
    author:        raw.artistName ?? '',
  };
}

export const ITunesAPI = {
  searchBooks: (query: string, page = 1, genre?: string) =>
    invoke<RawSearchResult>('itunes_search', { query, page, genre: genre ?? null })
      .then(r => mapPage(r, page)),

  bookDetails: (id: string): Promise<MediaDetail> =>
    invoke<any>('itunes_details', { id }).then(mapDetail),

  // Apple Books has no public genre endpoint — return the curated list.
  genres: (): Promise<GenreOption[]> => Promise.resolve(ITUNES_BOOK_GENRES),
};
