import { describe, expect, it, vi } from "vitest";
import type { Catalog } from "$lib/api/catalog";
import type { GenreId, GenreOption, MediaItem, MediaType } from "$lib/types/media";
import { BrowseStore, MAX_CAROUSELS } from "./browse.svelte";

const item = (id: number): MediaItem => ({
  id,
  title: `T${id}`,
  overview: "",
  poster_path: null,
  backdrop_path: null,
  vote_average: 0,
  vote_count: 0,
  media_type: "movie",
});
const genres = (n: number): GenreOption[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `G${i + 1}` }));
const page = (ids: number[], total_pages = 1) => ({
  results: ids.map(item),
  page: 1,
  total_pages,
  total_results: ids.length,
});

function fakeCatalog(over: Partial<Catalog> = {}): Catalog {
  return {
    fetchGenres: vi.fn(async () => genres(10)),
    fetchPage: vi.fn(async () => page([1, 2])),
    fetchDetail: vi.fn(),
    ...over,
  } as Catalog;
}

describe("BrowseStore", () => {
  it("refreshView: loads genres once, then one carousel per top genre (capped)", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    await s.refreshView();
    expect(s.carouselMode).toBe(true);
    expect(s.sections).toHaveLength(MAX_CAROUSELS);
    expect(s.sections.every((x) => !x.loading && x.items.length === 2)).toBe(true);
    expect(cat.fetchPage).toHaveBeenCalledTimes(MAX_CAROUSELS);
    await s.refreshView();
    expect(cat.fetchGenres).toHaveBeenCalledTimes(1); // cached per category
  });

  it("a failing carousel shows its own error; the others still load", async () => {
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (_c: MediaType, _q: string, _p: number, g: GenreId | null) => {
        if (g === 1) throw "HTTP 429";
        return page([1]);
      }),
    });
    const s = new BrowseStore(cat);
    await s.refreshView();
    expect(s.sections[0].error).toBe("HTTP 429");
    expect(s.sections[1].items).toHaveLength(1);
  });

  it("falls back to a flat grid when a category has no genres", async () => {
    const s = new BrowseStore(fakeCatalog({ fetchGenres: vi.fn(async () => []) }));
    await s.refreshView();
    expect(s.sections).toEqual([]);
    expect(s.items).toHaveLength(2);
  });

  it("search: switches to grid mode and clears the genre", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    s.activeGenre = 3;
    await s.search("heat");
    expect(s.isSearch).toBe(true);
    expect(s.activeGenre).toBeNull();
    expect(s.carouselMode).toBe(false);
    expect(cat.fetchPage).toHaveBeenLastCalledWith("movie", "heat", 1, null);
  });

  it("clearSearch: back to carousels", async () => {
    const s = new BrowseStore(fakeCatalog());
    await s.search("heat");
    await s.clearSearch();
    expect(s.isSearch).toBe(false);
    expect(s.carouselMode).toBe(true);
    expect(s.sections.length).toBeGreaterThan(0);
  });

  it("loadMore: appends the next page and stops at the last page", async () => {
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (_c: MediaType, _q: string, p: number) => page([p * 10], 2)),
    });
    const s = new BrowseStore(cat);
    await s.search("x");
    expect(s.hasMore).toBe(true);
    await s.loadMore();
    expect(s.items.map((i) => i.id)).toEqual([10, 20]);
    expect(s.hasMore).toBe(false);
    await s.loadMore(); // no-op at the end
    expect(cat.fetchPage).toHaveBeenCalledTimes(2);
  });

  it("grid errors are user-facing strings", async () => {
    const s = new BrowseStore(
      fakeCatalog({ fetchPage: vi.fn(async () => Promise.reject("Invalid API key")) }),
    );
    await s.search("x");
    expect(s.error).toBe("Invalid API key");
  });

  it("switchCategory: resets genre and ignores late results from the old category", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const cat = fakeCatalog({
      fetchPage: vi.fn(async (c: MediaType) => {
        if (c === "movie") await gate;
        return page([c === "movie" ? 1 : 2]);
      }),
    });
    const s = new BrowseStore(cat);
    const first = s.refreshView(); // movie carousels start, then block
    await vi.waitFor(() => expect(cat.fetchPage).toHaveBeenCalledWith("movie", "", 1, 1));
    s.activeGenre = 5;
    await s.switchCategory("anime"); // anime carousels fully load
    release(); // late movie results arrive now and must be dropped
    await first;
    expect(s.activeCategory).toBe("anime");
    expect(s.activeGenre).toBeNull();
    const ids = s.sections.flatMap((x) => x.items.map((i) => i.id));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id === 2)).toBe(true);
  });

  it("switchGenre to the same id is a no-op", async () => {
    const cat = fakeCatalog();
    const s = new BrowseStore(cat);
    await s.switchGenre(null); // activeGenre is already null
    expect(cat.fetchGenres).not.toHaveBeenCalled();
  });
});
