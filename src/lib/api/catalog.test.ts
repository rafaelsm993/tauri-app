import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { catalog } from "./catalog";

afterEach(() => clearMocks());

function record() {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    if (cmd.includes("genres")) return { genres: [] };
    return { page: 1, total_pages: 1, total_results: 0, results: [] };
  });
  return calls;
}

describe("catalog.fetchPage", () => {
  it("movie: discover with numeric genre when there is no query", async () => {
    const calls = record();
    await catalog.fetchPage("movie", "", 2, 28);
    expect(calls).toEqual([{ cmd: "tmdb_discover_movies", args: { page: 2, genre: 28 } }]);
  });

  it("movie: search when the query is non-blank (genre ignored)", async () => {
    const calls = record();
    await catalog.fetchPage("movie", "heat", 1, 28);
    expect(calls).toEqual([{ cmd: "tmdb_search_movies", args: { query: "heat", page: 1 } }]);
  });

  it("movie: a string genre id is dropped (ids are not portable)", async () => {
    const calls = record();
    await catalog.fetchPage("movie", "", 1, "action");
    expect(calls[0].args).toEqual({ page: 1, genre: null });
  });

  it("anime: always the search command, blank query allowed, slug genre", async () => {
    const calls = record();
    await catalog.fetchPage("anime", "  ", 1, "Action");
    expect(calls).toEqual([
      { cmd: "anilist_search_anime", args: { query: "", page: 1, genre: "Action" } },
    ]);
  });

  it("book: blank query becomes 'popular'", async () => {
    const calls = record();
    await catalog.fetchPage("book", "", 1, null);
    expect(calls[0]).toEqual({
      cmd: "itunes_search",
      args: { query: "popular", page: 1, genre: null },
    });
  });

  it("game: discover vs search", async () => {
    const calls = record();
    await catalog.fetchPage("game", "", 1, "rpg");
    await catalog.fetchPage("game", "zelda", 1, null);
    expect(calls.map((c) => c.cmd)).toEqual(["rawg_discover", "rawg_search"]);
  });
});

describe("catalog.fetchDetail", () => {
  it("rejects a non-numeric id for numeric providers without calling IPC", async () => {
    const calls = record();
    await expect(catalog.fetchDetail("movie", "abc")).rejects.toBe("Invalid ID.");
    expect(calls).toEqual([]);
  });

  it("rejects an unknown media type", async () => {
    await expect(catalog.fetchDetail("podcast", "1")).rejects.toBe("Invalid media type.");
  });

  it("book ids are URI-decoded strings", async () => {
    const calls: string[] = [];
    mockIPC((cmd, args) => {
      calls.push(`${cmd}:${(args as { id: string }).id}`);
      return {};
    });
    await catalog.fetchDetail("book", "abc%2F1");
    expect(calls).toEqual(["itunes_details:abc/1"]);
  });
});

describe("catalog.fetchGenres", () => {
  it("maps the provider genre list", async () => {
    record();
    await expect(catalog.fetchGenres("movie")).resolves.toEqual([]);
  });
});
