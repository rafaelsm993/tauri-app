import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import GenreCarousel from "./GenreCarousel.svelte";

describe("GenreCarousel", () => {
  it("offers a retry button when its row failed to load", async () => {
    const onRetry = vi.fn();
    render(GenreCarousel, {
      title: "Ação",
      items: [],
      error: "HTTP 429",
      onCardClick: () => {},
      onRetry,
    });
    expect(screen.getByText(/HTTP 429/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no retry button without an error", () => {
    render(GenreCarousel, { title: "Ação", items: [], onCardClick: () => {}, onRetry: () => {} });
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });
});
