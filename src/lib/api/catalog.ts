// One entry point per operation for every MediaType. Routes and stores call
// this; it picks the provider service. Components still never call invoke.
import { TmdbAPI } from "$lib/api/tmdb";
import { AnilistAPI } from "$lib/api/anilist";
import { ITunesAPI } from "$lib/api/itunes";
import { RawgAPI } from "$lib/api/rawg";
import type {
  GenreId,
  GenreOption,
  MediaDetail,
  MediaItem,
  MediaType,
  PaginatedResult,
} from "$lib/types/media";

const EMPTY_PAGE: PaginatedResult<MediaItem> = {
  results: [],
  page: 1,
  total_pages: 1,
  total_results: 0,
};

// TMDB genre ids are numbers; AniList/iTunes/RAWG use string slugs.
const numericGenre = (g: GenreId | null) => (typeof g === "number" ? g : undefined);
const slugGenre = (g: GenreId | null) => (typeof g === "string" ? g : undefined);

function fetchGenres(cat: MediaType): Promise<GenreOption[]> {
  switch (cat) {
    case "movie":
      return TmdbAPI.movieGenres();
    case "tv":
      return TmdbAPI.tvGenres();
    case "anime":
      return AnilistAPI.animeGenres();
    case "manga":
      return AnilistAPI.mangaGenres();
    case "book":
      return ITunesAPI.genres();
    case "game":
      return RawgAPI.genres();
    default:
      return Promise.resolve([]);
  }
}

// TMDB and RAWG search get the raw query, AniList and iTunes the trimmed one
// (unchanged from the original page code).
function fetchPage(
  cat: MediaType,
  query: string,
  page: number,
  genre: GenreId | null,
): Promise<PaginatedResult<MediaItem>> {
  const q = query.trim();
  switch (cat) {
    case "movie":
      return q
        ? TmdbAPI.searchMovies(query, page)
        : TmdbAPI.discoverMovies(page, numericGenre(genre));
    case "tv":
      return q ? TmdbAPI.searchTv(query, page) : TmdbAPI.discoverTv(page, numericGenre(genre));
    case "anime":
      return AnilistAPI.searchAnime(q, page, slugGenre(genre));
    case "manga":
      return AnilistAPI.searchManga(q, page, slugGenre(genre));
    case "book":
      return ITunesAPI.searchBooks(q || "popular", page, slugGenre(genre));
    case "game":
      return q
        ? RawgAPI.searchGames(query, page, slugGenre(genre))
        : RawgAPI.discoverGames(page, slugGenre(genre));
    default:
      return Promise.resolve(EMPTY_PAGE);
  }
}

const NUMERIC_DETAILS: Record<string, ((id: number) => Promise<MediaDetail>) | undefined> = {
  movie: TmdbAPI.movieDetails,
  tv: TmdbAPI.tvDetails,
  anime: AnilistAPI.animeDetails,
  manga: AnilistAPI.mangaDetails,
  game: RawgAPI.gameDetails,
};

// `type` and `id` come straight from the URL, so they are untrusted strings.
// Rejects with a user-facing message, like a failed Tauri command would.
function fetchDetail(type: string, id: string): Promise<MediaDetail> {
  if (type === "book") return ITunesAPI.bookDetails(decodeURIComponent(id));
  const load = NUMERIC_DETAILS[type];
  if (!load) return Promise.reject("Tipo de mídia inválido.");
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return Promise.reject("ID inválido.");
  return load(numId);
}

export const catalog = { fetchGenres, fetchPage, fetchDetail };
export type Catalog = typeof catalog;
