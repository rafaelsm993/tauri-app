// Svelte attachment: run `cb` once, when the element first comes near the
// viewport. Used to lazy-load home carousels so a category with ~20 genres
// doesn't fire ~20 requests on first paint (provider rate limits; see the
// request-layer story S2·B6 for the real cache/back-off).
//
//   <div {@attach whenVisible(() => load())}>…</div>
import type { Attachment } from "svelte/attachments";

export function whenVisible(
  cb: () => void,
  { rootMargin = "0px" }: { rootMargin?: string } = {},
): Attachment<Element> {
  return (el) => {
    if (typeof IntersectionObserver === "undefined") {
      cb();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        cb();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  };
}
