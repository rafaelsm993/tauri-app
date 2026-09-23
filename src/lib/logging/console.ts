// Forwards the webview's console.* into tauri-plugin-log, so frontend logs
// land in the same terminal / log file / logcat as the Rust side.
//
// The reverse direction (Rust logs -> devtools console) is handled by the
// plugin's Webview target in dev builds, so attachConsole() is deliberately
// not used here: combining both would echo every line back and forth.
import { debug, error, info, trace, warn } from "@tauri-apps/plugin-log";

type Level = "log" | "debug" | "info" | "warn" | "error";

const SINKS: Record<Level, (message: string) => Promise<void>> = {
  log: trace,
  debug,
  info,
  warn,
  error,
};

function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
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

  const originals = {} as Record<Level, (...args: unknown[]) => void>;
  for (const level of Object.keys(SINKS) as Level[]) {
    const original = console[level];
    originals[level] = original;
    console[level] = (...args: unknown[]) => {
      original.apply(console, args);
      // Swallow IPC failures: a broken logger must never break the caller,
      // and logging the failure would recurse.
      SINKS[level](format(args)).catch(() => {});
    };
  }

  return () => {
    for (const level of Object.keys(originals) as Level[]) {
      console[level] = originals[level];
    }
  };
}
