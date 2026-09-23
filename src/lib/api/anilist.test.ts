import { describe, expect, it } from "vitest";
import { pickTitle } from "./anilist";

describe("pickTitle", () => {
  it("prefers the English title over userPreferred", () => {
    expect(pickTitle({ userPreferred: "Shingeki no Kyojin", english: "Attack on Titan" })).toBe(
      "Attack on Titan",
    );
  });

  it("falls back to romaji, then native, then Untitled", () => {
    expect(pickTitle({ romaji: "Shingeki no Kyojin", native: "進撃の巨人" })).toBe(
      "Shingeki no Kyojin",
    );
    expect(pickTitle({ native: "進撃の巨人" })).toBe("進撃の巨人");
    expect(pickTitle(null)).toBe("Untitled");
  });
});
