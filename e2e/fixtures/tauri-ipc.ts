import { test as base } from "@playwright/test";

// Deterministic data for every command the home + detail screens call on first paint
// (default category is "movie", so only TMDB commands are needed). Unknown commands
// get an empty page so the UI renders its empty state instead of crashing.
const MOVIE = (id: number) => ({
  id,
  title: `Filme de teste ${id} com um título bem comprido para quebrar layout`,
  overview: "Sinopse de teste. ".repeat(12),
  poster_path: null,
  backdrop_path: null,
  vote_average: 7.4,
  vote_count: 1234,
  release_date: "2024-05-01",
  genre_ids: [28],
});

const FIXTURES: Record<string, unknown> = {
  tmdb_genres_movies: {
    genres: [
      { id: 28, name: "Ação" },
      { id: 35, name: "Comédia" },
      { id: 18, name: "Drama" },
      // Real TMDB returns ~19 genres, so the home page renders MAX_CAROUSELS (8) rails.
      { id: 27, name: "Terror" },
      { id: 878, name: "Ficção científica" },
      { id: 16, name: "Animação" },
      { id: 53, name: "Thriller" },
      { id: 10749, name: "Romance" },
    ],
  },
  tmdb_discover_movies: {
    page: 1,
    total_pages: 1,
    total_results: 12,
    results: Array.from({ length: 12 }, (_, i) => MOVIE(i + 1)),
  },
  tmdb_movie_details: {
    ...MOVIE(1),
    tagline: "Tagline",
    runtime: 128,
    genres: [{ id: 28, name: "Ação" }],
    credits: { cast: [] },
    videos: { results: [] },
    production_companies: [],
  },
};

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((fixtures) => {
      const empty = { page: 1, total_pages: 1, total_results: 0, results: [], genres: [] };
      // Shape consumed by @tauri-apps/api/core `invoke()`.
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => structuredClone(fixtures[cmd] ?? empty),
        transformCallback: () => 0,
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      };
    }, FIXTURES);
    await use(page);
  },
});
export { expect } from "@playwright/test";
