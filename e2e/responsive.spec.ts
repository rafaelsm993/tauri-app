import { expect, test } from "./fixtures/tauri-ipc";

const SCREENS = [
  { name: "home", path: "/" },
  { name: "detail", path: "/media/movie/1" },
  { name: "library", path: "/library" },
  { name: "profile", path: "/profile" },
  { name: "planner", path: "/planner" },
  { name: "welcome", path: "/welcome" },
];

for (const screen of SCREENS) {
  test.describe(`${screen.name} screen`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
    });

    test("has no horizontal page overflow", async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
    });
  });
}

test.describe("touch devices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("category tabs are at least 44px tall on coarse pointers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    const heights = await page
      .getByRole("navigation", { name: "Categorias" })
      .getByRole("button")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBe(6);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("every category tab is reachable (fits or scrolls horizontally)", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Categorias" });
    const ok = await nav.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.scrollWidth <= el.clientWidth || ["auto", "scroll"].includes(s.overflowX);
    });
    expect(ok, "tabs overflow their nav and can't be scrolled to").toBe(true);
  });

  test("home content column is not collapsed in the stacked layout", async ({ page }) => {
    const height = await page.getByRole("main").evaluate((el) => el.getBoundingClientRect().height);
    expect(height, "main column collapsed to 0 px and clips its content").toBeGreaterThan(0);
  });

  test("back-to-top button appears after scrolling and is touch-sized", async ({
    page,
    isMobile,
  }) => {
    const button = page.getByRole("button", { name: "Voltar ao topo" });
    await expect(button).toHaveCount(0);

    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect(button).toBeVisible();

    const box = await button.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, "button has no layout box").not.toBeNull();
    // Fully on screen (fixed bottom-right, not clipped off the edge).
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    if (isMobile) {
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(button).toHaveCount(0);
  });

  test("card details are visible without hover", async ({ page, isMobile }) => {
    test.skip(!isMobile, "hover reveal is fine on mouse devices");
    const opacity = await page
      .locator(".card__overlay")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});
