import type { MediaType } from "$lib/types/media";

// Up to two initials for avatar fallbacks.
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// `runtime` is minutes for everything except books, where providers put pages.
export function formatRuntime(runtime: number | null | undefined, type: MediaType): string {
  if (!runtime) return "";
  return type === "book" ? `${runtime} páginas` : `${Math.floor(runtime / 60)}h ${runtime % 60}m`;
}
