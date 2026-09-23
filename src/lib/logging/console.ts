// Forwards the webview's console.* into tauri-plugin-log, so frontend logs
// also land in the terminal / log file / logcat next to the Rust logs.
//
// One direction only, on purpose: the devtools console shows frontend output,
// and Rust logs stay in the terminal and log file (no mirroring into devtools).
import { debug, error, info, warn } from "@tauri-apps/plugin-log";

type Level = "log" | "debug" | "info" | "warn" | "error";
type ConsoleFn = (...args: unknown[]) => void;

const LEVELS: Level[] = ["log", "debug", "info", "warn", "error"];

// console.log is everyday debugging output: send it at debug, not trace, so
// it passes the dev-build default level instead of being filtered out.
const SINKS: Record<Level, (message: string) => Promise<void>> = {
  log: debug,
  debug,
  info,
  warn,
  error,
};

export function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.stack ?? `${a.name}: ${a.message}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Patches console.{log,debug,info,warn,error} to also write through the log
 * plugin. The original method is still called, so devtools output is
 * unchanged. No-op outside Tauri (plain browser, Playwright, SSR).
 * Returns a function that restores the original methods.
 */
export function forwardConsole(): () => void {
  if (!inTauri()) return () => {};

  const originals = {} as Record<Level, ConsoleFn>;
  for (const level of LEVELS) {
    const original = console[level] as ConsoleFn;
    originals[level] = original;
    console[level] = (...args: unknown[]) => {
      original.apply(console, args);
      // Swallow IPC failures: a broken logger must never break the caller,
      // and logging the failure would recurse.
      SINKS[level](format(args)).catch(() => {});
    };
  }

  return () => {
    for (const level of LEVELS) {
      console[level] = originals[level];
    }
  };
}
