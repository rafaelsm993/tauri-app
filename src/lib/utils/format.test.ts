import { describe, expect, it } from "vitest";
import { formatRuntime, initials } from "./format";

describe("initials", () => {
  it("takes first + last initial, uppercased", () => {
    expect(initials("keanu charles reeves")).toBe("KR");
  });

  it("takes two letters from a single name", () => {
    expect(initials("Zendaya")).toBe("ZE");
  });

  it("returns ? for blank names", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("formatRuntime", () => {
  it("formats minutes as h/m", () => {
    expect(formatRuntime(128, "movie")).toBe("2h 8m");
  });

  it("formats books as pages", () => {
    expect(formatRuntime(320, "book")).toBe("320 pages");
  });

  it("is empty when unknown", () => {
    expect(formatRuntime(null, "movie")).toBe("");
    expect(formatRuntime(0, "game")).toBe("");
  });
});
