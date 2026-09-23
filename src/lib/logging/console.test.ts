import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
  trace: vi.fn(() => Promise.resolve()),
  debug: vi.fn(() => Promise.resolve()),
  info: vi.fn(() => Promise.resolve()),
  warn: vi.fn(() => Promise.resolve()),
  error: vi.fn(() => Promise.resolve()),
  attachLogger: vi.fn(() => Promise.resolve(() => {})),
  attachConsole: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/plugin-log", () => plugin);

import { format, forwardConsole } from "./console";

const LEVELS = ["log", "debug", "info", "warn", "error"] as const;
const saved = Object.fromEntries(LEVELS.map((l) => [l, console[l]]));

function setTauri(on: boolean) {
  if (on) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  else delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

describe("forwardConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const l of LEVELS) console[l] = vi.fn();
  });

  afterEach(() => {
    for (const l of LEVELS) console[l] = saved[l];
    setTauri(false);
  });

  it("is a no-op outside Tauri (plain browser, Playwright)", () => {
    setTauri(false);
    const original = console.info;
    const restore = forwardConsole();
    console.info("x");
    expect(console.info).toBe(original);
    expect(plugin.info).not.toHaveBeenCalled();
    restore();
  });

  it("forwards each console level; console.log goes out at debug so it isn't filtered", () => {
    setTauri(true);
    const restore = forwardConsole();
    console.log("a");
    console.debug("b");
    console.info("c");
    console.warn("d");
    console.error("e");
    expect(plugin.debug).toHaveBeenCalledWith("a");
    expect(plugin.debug).toHaveBeenCalledWith("b");
    expect(plugin.info).toHaveBeenCalledWith("c");
    expect(plugin.warn).toHaveBeenCalledWith("d");
    expect(plugin.error).toHaveBeenCalledWith("e");
    expect(plugin.trace).not.toHaveBeenCalled();
    restore();
  });

  it("still calls the original console so devtools output is unchanged", () => {
    setTauri(true);
    const original = console.warn;
    const restore = forwardConsole();
    console.warn("kept");
    expect(original).toHaveBeenCalledWith("kept");
    restore();
  });

  it("does not mirror Rust logs into devtools (terminal/log file only)", () => {
    setTauri(true);
    const restore = forwardConsole();
    expect(plugin.attachLogger).not.toHaveBeenCalled();
    expect(plugin.attachConsole).not.toHaveBeenCalled();
    restore();
  });

  it("restore() puts the original console methods back", () => {
    setTauri(true);
    const originals = LEVELS.map((l) => console[l]);
    const restore = forwardConsole();
    expect(console.info).not.toBe(originals[2]);
    restore();
    LEVELS.forEach((l, i) => expect(console[l]).toBe(originals[i]));
  });
});

describe("format", () => {
  it("joins strings and JSON-encodes objects", () => {
    expect(format(["failed:", { id: 1 }])).toBe('failed: {"id":1}');
  });

  it("keeps the stack trace of errors", () => {
    const e = new Error("boom");
    expect(format([e])).toBe(e.stack);
  });

  it("falls back to String() for values JSON can't encode", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(format([cyclic])).toBe("[object Object]");
  });
});
