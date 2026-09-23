import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import RoutePlaceholder from "./RoutePlaceholder.svelte";

describe("RoutePlaceholder", () => {
  it("renders the title as the page heading and a link home", () => {
    render(RoutePlaceholder, { title: "Library" });
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
  });
});
