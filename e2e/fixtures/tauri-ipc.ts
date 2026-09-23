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
  // Real TMDB count (19): the home page renders one lazy carousel per genre.
  tmdb_genres_movies: {
    genres: [
      [28, "Ação"],
      [12, "Aventura"],
      [16, "Animação"],
      [35, "Comédia"],
      [80, "Crime"],
      [99, "Documentário"],
      [18, "Drama"],
      [10751, "Família"],
      [14, "Fantasia"],
      [36, "História"],
      [27, "Terror"],
      [10402, "Música"],
      [9648, "Mistério"],
      [10749, "Romance"],
      [878, "Ficção científica"],
      [10770, "Cinema TV"],
      [53, "Thriller"],
      [10752, "Guerra"],
      [37, "Faroeste"],
    ].map(([id, name]) => ({ id, name })),
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
      // Every command name, in call order: lets tests assert request volume.
      const calls: string[] = [];
      Object.assign(window, { __ipcCalls: calls });
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          calls.push(cmd);
          return structuredClone(fixtures[cmd] ?? empty);
        },
        transformCallback: () => 0,
        metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
      };
    }, FIXTURES);
    await use(page);
  },
});
export { expect } from "@playwright/test";
