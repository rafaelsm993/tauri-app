// Normalizes Tauri string rejections and Error objects into one message.
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === "string" && e) return e;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
