import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import MultiSelect from "./MultiSelect.svelte";

const options = [
  { value: 28, label: "Ação" },
  { value: 35, label: "Comédia" },
  { value: "drama", label: "Drama" }, // string ids exist too (AniList / iTunes / RAWG)
];

function setup(selected: (string | number)[] = [], disabled = false) {
  const onchange = vi.fn();
  const r = render(MultiSelect, { label: "Gêneros", options, selected, onchange, disabled });
  return { onchange, trigger: screen.getByRole("button", { name: /^Gêneros/ }), ...r };
}

describe("MultiSelect", () => {
  it("trigger shows the label, plus the count when something is selected", async () => {
    const { trigger, rerender } = setup();
    expect(trigger).toHaveTextContent(/^Gêneros$/);
    await rerender({ selected: [28, "drama"] });
    expect(trigger).toHaveTextContent("Gêneros · 2");
  });

  it("trigger controls the panel and reflects its open state", () => {
    const { trigger } = setup();
    const panelId = trigger.getAttribute("popovertarget");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toHaveAttribute("popover", "auto");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders one checkbox per option, checked from `selected`, in a labelled group", () => {
    setup([35]);
    const group = screen.getByRole("group", { name: "Gêneros", hidden: true });
    const boxes = within(group).getAllByRole("checkbox", { hidden: true });
    expect(
      boxes.map((b) => b.getAttribute("aria-label") ?? b.closest("label")?.textContent?.trim()),
    ).toEqual(["Ação", "Comédia", "Drama"]);
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([false, true, false]);
  });

  it("toggling emits the next selection with original value types, in option order", async () => {
    const { onchange } = setup([35]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Drama", hidden: true }));
    expect(onchange).toHaveBeenLastCalledWith([35, "drama"]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Ação", hidden: true }));
    expect(onchange).toHaveBeenLastCalledWith([28, 35]);

    await userEvent.click(screen.getByRole("checkbox", { name: "Comédia", hidden: true }));
    expect(onchange).toHaveBeenLastCalledWith([]);
  });

  it("'Limpar' clears everything and only shows when something is selected", async () => {
    const { onchange, rerender } = setup([28, 35]);
    await userEvent.click(screen.getByRole("button", { name: "Limpar", hidden: true }));
    expect(onchange).toHaveBeenCalledExactlyOnceWith([]);
    await rerender({ selected: [] });
    expect(screen.queryByRole("button", { name: "Limpar", hidden: true })).toBeNull();
  });

  it("can be disabled", () => {
    const { trigger } = setup([], true);
    expect(trigger).toBeDisabled();
  });
});
