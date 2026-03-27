// ================================================================
// TauriFlix — Core Media Types
// Designed to be reused by TMDB, Jikan (anime) and OpenLibrary.
// ================================================================

// Generic paginated envelope — mirrors TMDB, Jikan, etc.
export interface PaginatedResult<T> {
  results:       T[];
  page:          number;
  total_pages:   number;
  total_results: number;
}

// Unified media item — every provider maps into this shape
export interface MediaItem {
  id:            number;
  title:         string;
  overview:      string;
  poster_path:   string | null;
  backdrop_path: string | null;
  vote_average:  number;
  vote_count:    number;
  release_date?: string;    // movies
  first_air_date?:string;   // tv series
  genre_ids?:    number[];
  media_type?:   'movie' | 'tv' | 'anime' | 'book';
}

// ── Detail sub-types ────────────────────────────────────────
export interface Genre { id: number; name: string; }
export interface CastMember { id: number; name: string; character: string; profile_path: string | null; }
export interface VideoClip { key: string; site: string; type: string; name: string; }

export interface MediaDetail {
  id:            number;
  media_type:    'movie' | 'tv';
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

// ── Derived display helpers ─────────────────────────────────
export const getYear = (item: MediaItem): string => {
  const d = item.release_date ?? item.first_air_date;
  return d ? d.slice(0, 4) : '';
};

export const getRating = (item: MediaItem): string =>
  item.vote_average > 0 ? item.vote_average.toFixed(1) : '';