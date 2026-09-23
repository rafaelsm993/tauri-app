// Tauri commands reject with a plain string; JS code throws Error objects.
// Every catch site in the UI turns either into one user-facing message.
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === "string" && e) return e;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
