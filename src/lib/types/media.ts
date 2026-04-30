// ================================================================
// TauriFlix — Core Media Types
// Designed to be reused by TMDB, Jikan (anime/manga) and OpenLibrary.
// ================================================================

export type MediaType = 'movie' | 'tv' | 'anime' | 'manga' | 'book';

// Generic paginated envelope — mirrors TMDB, Jikan, etc.
export interface PaginatedResult<T> {
  results:       T[];
  page:          number;
  total_pages:   number;
  total_results: number;
}

// Unified media item — every provider maps into this shape
export interface MediaItem {
  id:            number | string;  // string for OpenLibrary keys
  title:         string;
  overview:      string;
  poster_path:   string | null;    // full URL for Jikan/OpenLibrary, TMDB path for TMDB
  backdrop_path: string | null;
  vote_average:  number;
  vote_count:    number;
  release_date?: string;           // movies
  first_air_date?:string;          // tv series
  genre_ids?:    number[];
  media_type:    MediaType;
  // Provider-specific extras
  author?:       string;           // books
  episodes?:     number | null;    // anime
  chapters?:     number | null;    // manga
}

// ── Detail sub-types ────────────────────────────────────────
export interface Genre { id: number; name: string; }
export interface CastMember { id: number; name: string; character: string; profile_path: string | null; }
export interface VideoClip { key: string; site: string; type: string; name: string; }

export interface MediaDetail {
  id:            number | string;
  media_type:    MediaType;
  title:         string;
  tagline:       string;
  overview:      string;
  poster_path:   string | null;
  backdrop_path: string | null;
  vote_average:  number;
  vote_count:    number;
  release_date:  string;
  runtime:       number | null;
  genres:        Genre[];
  cast:          CastMember[];
  videos:        VideoClip[];
  // Provider-specific extras
  author?:       string;
  episodes?:     number | null;
  chapters?:     number | null;
  volumes?:      number | null;
  status?:       string;
  studios?:      string[];
  subjects?:     string[];
}

// ── TMDB image URL builder ──────────────────────────────────
const TMDB_BASE = 'https://image.tmdb.org/t/p';

export const TMDB_IMG = {
  poster: (path: string | null, size: 'w185'|'w342'|'w500' = 'w342') =>
    path ? `${TMDB_BASE}/${size}${path}` : null,
  backdrop: (path: string | null, size: 'w780'|'w1280' = 'w780') =>
    path ? `${TMDB_BASE}/${size}${path}` : null,
  profile: (path: string | null, size: 'w185'|'w342' = 'w185') =>
    path ? `${TMDB_BASE}/${size}${path}` : null,
} as const;

// ── OpenLibrary cover URL builder ───────────────────────────
export const OL_IMG = {
  cover: (coverId: number | null, size: 'S'|'M'|'L' = 'M') =>
    coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : null,
} as const;

// ── Unified poster URL helper ───────────────────────────────
// All current providers (TVmaze, Jikan, OpenLibrary) store absolute URLs in
// poster_path. The TMDB_IMG helper above is kept only for legacy callers
// that still hold a relative TMDB path.
export function getPosterUrl(item: MediaItem): string | null {
  if (!item.poster_path) return null;
  if (item.media_type === 'movie') {
    return TMDB_IMG.poster(item.poster_path);
  }
  return item.poster_path;
}

// ── Derived display helpers ─────────────────────────────────
export const getYear = (item: MediaItem): string => {
  const d = item.release_date ?? item.first_air_date;
  return d ? d.slice(0, 4) : '';
};

export const getRating = (item: MediaItem): string =>
  item.vote_average > 0 ? item.vote_average.toFixed(1) : '';

export const MEDIA_LABELS: Record<MediaType, string> = {
  movie: 'Filme',
  tv: 'Série',
  anime: 'Anime',
  manga: 'Mangá',
  book: 'Livro',
};
