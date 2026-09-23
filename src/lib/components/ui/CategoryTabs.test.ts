import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { MEDIA_LABELS } from "$lib/types/media";
import CategoryTabs from "./CategoryTabs.svelte";

describe("CategoryTabs", () => {
  it("marks only the active category as pressed", () => {
    render(CategoryTabs, { active: "anime", onchange: () => {} });
    expect(screen.getByRole("button", { name: "Anime" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Jogos" })).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the category key on click", async () => {
    const onchange = vi.fn();
    render(CategoryTabs, { active: "movie", onchange });
    await userEvent.click(screen.getByRole("button", { name: "Jogos" }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith("game");
  });

  it("maps every tab to a distinct MediaType key (by value, not label)", async () => {
    // MEDIA_LABELS is Record<MediaType, string>, so its keys are the runtime MediaType set.
    const mediaTypes = Object.keys(MEDIA_LABELS);
    const onchange = vi.fn();
    render(CategoryTabs, { active: "movie", onchange });

    const nav = screen.getByRole("navigation", { name: "Categorias" });
    const tabs = within(nav).getAllByRole("button");
    for (const tab of tabs) await userEvent.click(tab);

    const keys = onchange.mock.calls.map(([key]) => key);
    expect(keys).toHaveLength(tabs.length);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(mediaTypes).toContain(key);
  });
});
