// Bridges the webview console and tauri-plugin-log in both directions, so
// every log line is visible in the terminal / log file / logcat AND in the
// devtools console:
//
//   frontend console.*  → plugin → terminal, log file, logcat
//   Rust log::*         → plugin Webview target (dev builds) → devtools console
//
// Echo safety: Rust's Webview target only emits Rust records (lib.rs filters
// out `webview` records), and incoming Rust lines are printed with the
// ORIGINAL console methods, so they are never forwarded back to the plugin.
import { attachLogger, debug, error, info, LogLevel, warn } from "@tauri-apps/plugin-log";

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

const LEVEL_TO_CONSOLE: Record<LogLevel, Level> = {
  [LogLevel.Trace]: "debug",
  [LogLevel.Debug]: "debug",
  [LogLevel.Info]: "info",
  [LogLevel.Warn]: "warn",
  [LogLevel.Error]: "error",
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
 * plugin, and prints Rust log records into the devtools console (tagged
 * `[rust]`). The original console method is still called, so devtools output
 * for frontend logs is unchanged. No-op outside Tauri (plain browser,
 * Playwright, SSR). Returns a function that undoes both.
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

  let stopListening: (() => void) | undefined;
  let stopped = false;
  attachLogger(({ level, message }) => {
    const target = LEVEL_TO_CONSOLE[level] ?? "info";
    originals[target].call(console, `[rust] ${message}`);
  })
    .then((unlisten) => {
      if (stopped) unlisten();
      else stopListening = unlisten;
    })
    .catch(() => {});

  return () => {
    stopped = true;
    stopListening?.();
    for (const level of LEVELS) {
      console[level] = originals[level];
    }
  };
}
