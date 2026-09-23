import type { Attachment } from "svelte/attachments";

// Runs cb once when the element nears the viewport; lazy-loads carousels.
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
