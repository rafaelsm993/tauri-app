import { invoke } from "@tauri-apps/api/core";
import type { MediaItem, MediaDetail, PaginatedResult, GenreOption } from "$lib/types/media";

// Apple ignores genreId for ebooks, so genres are folded into the search term.
const ITUNES_BOOK_GENRES: GenreOption[] = [
  { id: "romance", name: "Romance" },
  { id: "fantasy", name: "Fantasy" },
  { id: "science fiction", name: "Science Fiction" },
  { id: "mystery", name: "Mystery" },
  { id: "thriller", name: "Thriller" },
  { id: "horror", name: "Horror" },
  { id: "adventure", name: "Adventure" },
  { id: "drama", name: "Drama" },
  { id: "biography", name: "Biography" },
  { id: "history", name: "History" },
  { id: "self-help", name: "Self-Help" },
  { id: "business", name: "Business" },
  { id: "philosophy", name: "Philosophy" },
  { id: "religion", name: "Religion" },
  { id: "cooking", name: "Cooking" },
  { id: "children", name: "Children" },
  { id: "young adult", name: "Young Adult" },
  { id: "comics", name: "Comics" },
  { id: "poetry", name: "Poetry" },
  { id: "technology", name: "Technology" },
];

interface RawSearchResult {
  resultCount: number;
  results: any[];
}

const PAGE_SIZE = 20;

function upscaleCover(url: string | undefined | null, size = 600): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb(-\d+)?\.(jpg|png)$/i, `/${size}x${size}bb.jpg`);
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").trim();
}

function genreId(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function map(raw: any): MediaItem {
  const year = (raw.releaseDate ?? "").slice(0, 4);
  return {
    id: String(raw.trackId),
    title: raw.trackName ?? raw.trackCensoredName ?? "Untitled",
    overview: stripHtml(raw.description),
    poster_path: upscaleCover(raw.artworkUrl100 ?? raw.artworkUrl60, 600),
    backdrop_path: null,
    vote_average: raw.averageUserRating ?? 0,
    vote_count: raw.userRatingCount ?? 0,
    release_date: year || undefined,
    media_type: "book",
    author: raw.artistName ?? "",
  };
}

// iTunes returns no total; advertise one more page while the current one is full.
function mapPage(raw: RawSearchResult, page: number): PaginatedResult<MediaItem> {
  const items = raw.results ?? [];
  const hasMore = items.length >= PAGE_SIZE;
  return {
    results: items.map(map),
    page,
    total_pages: hasMore ? page + 1 : page,
    total_results: raw.resultCount ?? items.length,
  };
}

function mapDetail(raw: any): MediaDetail {
  const genres = Array.isArray(raw.genres) ? raw.genres : [];
  return {
    id: String(raw.trackId),
    media_type: "book",
    title: raw.trackName ?? raw.trackCensoredName ?? "Untitled",
    tagline: raw.artistName ?? "",
    overview: stripHtml(raw.description),
    poster_path: upscaleCover(raw.artworkUrl100 ?? raw.artworkUrl60, 1200),
    backdrop_path: null,
    vote_average: raw.averageUserRating ?? 0,
    vote_count: raw.userRatingCount ?? 0,
    release_date: raw.releaseDate ?? "",
    runtime: null,
    genres: genres.map((g: string) => ({ id: genreId(g), name: g })),
    cast: [],
    videos: [],
    subjects: genres,
    author: raw.artistName ?? "",
  };
}

export const ITunesAPI = {
  searchBooks: (query: string, page = 1, genre?: string) =>
    invoke<RawSearchResult>("itunes_search", { query, page, genre: genre ?? null }).then((r) =>
      mapPage(r, page),
    ),

  bookDetails: (id: string): Promise<MediaDetail> =>
    invoke<any>("itunes_details", { id }).then(mapDetail),

  genres: (): Promise<GenreOption[]> => Promise.resolve(ITUNES_BOOK_GENRES),
};
