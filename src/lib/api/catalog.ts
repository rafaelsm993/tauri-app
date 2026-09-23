import { invoke } from "@tauri-apps/api/core";
import type {
  GenreId,
  GenreOption,
  MediaDetail,
  MediaItem,
  MediaType,
  PaginatedResult,
} from "$lib/types/media";

function fetchGenres(cat: MediaType): Promise<GenreOption[]> {
  return invoke<GenreOption[]>("catalog_genres", { media_type: cat });
}

function fetchPage(
  cat: MediaType,
  query: string,
  page: number,
  genre: GenreId | null,
): Promise<PaginatedResult<MediaItem>> {
  return invoke<PaginatedResult<MediaItem>>("catalog_page", {
    media_type: cat,
    query,
    page,
    genre,
  });
}

// Args come from the URL (untrusted); Rust validates them and rejects with a user-facing message.
function fetchDetail(type: string, id: string): Promise<MediaDetail> {
  return invoke<MediaDetail>("catalog_detail", { media_type: type, id: decodeURIComponent(id) });
}

export const catalog = { fetchGenres, fetchPage, fetchDetail };
export type Catalog = typeof catalog;
