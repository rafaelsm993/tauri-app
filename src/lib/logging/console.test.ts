import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Record_ = { level: number; message: string };

const plugin = vi.hoisted(() => {
  const state: { listener?: (r: { level: number; message: string }) => void } = {};
  return {
    state,
    unlisten: vi.fn(),
    trace: vi.fn(() => Promise.resolve()),
    debug: vi.fn(() => Promise.resolve()),
    info: vi.fn(() => Promise.resolve()),
    warn: vi.fn(() => Promise.resolve()),
    error: vi.fn(() => Promise.resolve()),
    LogLevel: { Trace: 1, Debug: 2, Info: 3, Warn: 4, Error: 5 },
  };
});
vi.mock("@tauri-apps/plugin-log", () => ({
  ...plugin,
  attachLogger: vi.fn((fn: (r: Record_) => void) => {
    plugin.state.listener = fn;
    return Promise.resolve(plugin.unlisten);
  }),
}));

import { format, forwardConsole } from "./console";

const LEVELS = ["log", "debug", "info", "warn", "error"] as const;
const saved = Object.fromEntries(LEVELS.map((l) => [l, console[l]]));

function setTauri(on: boolean) {
  if (on) (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  else delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("forwardConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    plugin.state.listener = undefined;
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
    expect(plugin.state.listener).toBeUndefined();
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

  it("prints Rust records in devtools, tagged, at the matching level", async () => {
    setTauri(true);
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const restore = forwardConsole();
    await flush();
    plugin.state.listener!({ level: plugin.LogLevel.Info, message: "[tmdb] search → 200" });
    plugin.state.listener!({ level: plugin.LogLevel.Warn, message: "[rawg] HTTP 401" });
    expect(originalInfo).toHaveBeenCalledWith("[rust] [tmdb] search → 200");
    expect(originalWarn).toHaveBeenCalledWith("[rust] [rawg] HTTP 401");
    restore();
  });

  it("never echoes Rust records back to the plugin", async () => {
    setTauri(true);
    const restore = forwardConsole();
    await flush();
    plugin.state.listener!({ level: plugin.LogLevel.Info, message: "from rust" });
    expect(plugin.info).not.toHaveBeenCalled();
    restore();
  });

  it("restore() puts the console back and stops listening", async () => {
    setTauri(true);
    const originals = LEVELS.map((l) => console[l]);
    const restore = forwardConsole();
    await flush();
    expect(console.info).not.toBe(originals[2]);
    restore();
    LEVELS.forEach((l, i) => expect(console[l]).toBe(originals[i]));
    expect(plugin.unlisten).toHaveBeenCalledOnce();
  });

  it("restore() before the listener is ready still unlistens", async () => {
    setTauri(true);
    const restore = forwardConsole();
    restore();
    await flush();
    expect(plugin.unlisten).toHaveBeenCalledOnce();
  });
});

describe("format", () => {
  it("joins strings and JSON-encodes objects", () => {
    expect(format(["failed:", { id: 1 }])).toBe('failed: {"id":1}');
  });

  it("keeps the stack trace of errors", () => {
    const e = new Error("boom");
    expect(format([e])).toContain("boom");
    expect(format([e])).toBe(e.stack);
  });

  it("falls back to String() for values JSON can't encode", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(format([cyclic])).toBe("[object Object]");
  });
});
