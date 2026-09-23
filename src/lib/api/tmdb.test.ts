import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { TmdbAPI } from "./tmdb";

afterEach(() => clearMocks());

describe("TmdbAPI.discoverMovies", () => {
  it("invokes the right command and maps raw TMDB rows to MediaItem", async () => {
    const calls: Array<{ cmd: string; args: unknown }> = [];
    mockIPC((cmd, args) => {
      calls.push({ cmd, args });
      return {
        page: 1,
        total_pages: 3,
        total_results: 50,
        results: [
          { id: 7, title: "Heat", poster_path: "/p.jpg", backdrop_path: null, vote_average: 8.3 },
        ],
      };
    });

    const res = await TmdbAPI.discoverMovies(1, 28);

    expect(calls).toEqual([{ cmd: "tmdb_discover_movies", args: { page: 1, genre: 28 } }]);
    expect(res.total_pages).toBe(3);
    expect(res.results[0]).toMatchObject({
      id: 7,
      title: "Heat",
      media_type: "movie",
      poster_path: expect.stringMatching(/^https:\/\/.+\/w342\/p\.jpg$/),
      backdrop_path: null,
      vote_count: 0,
      overview: "",
    });
  });

  it("sends genre: null when no genre is given", async () => {
    let sent: unknown;
    mockIPC((_cmd, args) => {
      sent = args;
      return { page: 1, total_pages: 1, total_results: 0, results: [] };
    });
    await TmdbAPI.discoverMovies();
    expect(sent).toEqual({ page: 1, genre: null });
  });
});
