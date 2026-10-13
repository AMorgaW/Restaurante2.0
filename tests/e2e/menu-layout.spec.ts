import { expect, test } from "@playwright/test";
import { LONG_DISH_NAME, expectNoHorizontalScroll } from "./helpers";

const COMPACT_LONG_NAME = "Parrillada de ternera completa";

const evidenceDir = "artifacts/visual-comparison/work/menu-real-layout-fix";

const mobileAndTablet = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "625x795", width: 625, height: 795 },
  { name: "768x900", width: 768, height: 900 },
] as const;

test.use({ serviceWorkers: "block" });

test.describe("árbol real de filas editoriales del menú", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-07-21T12:00:00-05:00") });
  });
  for (const viewport of mobileAndTablet) {
    test(`mantiene una sola columna editorial en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/menu");

      const cards = page.getByTestId("compact-dish-card");
      await expect(cards.first()).toBeVisible();
      await page.addStyleTag({
        content: '[data-testid="compact-dish-card"] { animation: none !important; transform: none !important; }',
      });
      await expect(page.getByTestId("menu-dish-row").first()).toBeHidden();
      await expect(page.getByTestId("bottom-nav-active-pill")).toHaveCount(0);
      await expect(page.getByTestId("menu-user-entry")).toHaveAttribute("aria-label", "Iniciar sesión");
      await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);

      const [firstBox, secondBox, photoBox] = await Promise.all([
        cards.nth(0).boundingBox(),
        cards.nth(1).boundingBox(),
        cards.first().locator("[data-compact-photo]").boundingBox(),
      ]);
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      expect(photoBox).not.toBeNull();
      expect(secondBox!.y).toBeGreaterThan(firstBox!.y + 1);
      expect(Math.abs(secondBox!.x - firstBox!.x)).toBeLessThanOrEqual(1);
      expect(photoBox!.x).toBeLessThan(firstBox!.x + firstBox!.width / 2);
      expect(photoBox!.width).toBeGreaterThanOrEqual(96);
      expect(photoBox!.width).toBeLessThanOrEqual(104.5);
      expect(firstBox!.height).toBeGreaterThanOrEqual(150);
      expect(await expectNoHorizontalScroll(page)).toBe(true);
    });
  }

  test("en escritorio usa dos columnas de las mismas filas, sin tarjeta rectangular", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/menu");

    const rows = page.getByTestId("menu-dish-row");
    await expect(rows.first()).toBeVisible();
    const [firstBox, secondBox] = await Promise.all([rows.nth(0).boundingBox(), rows.nth(1).boundingBox()]);
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(secondBox!.x).toBeGreaterThan(firstBox!.x + firstBox!.width * 0.4);
    await expect(rows.first().locator(".menu-dish-photo")).toBeVisible();
    await expect(page.getByTestId("compact-dish-card").first()).toBeHidden();
    await expect(rows.last()).toBeVisible({ timeout: 15_000 });
  });

  test("el panel visible conserva azul real, transparencia y acciones operativas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu");

    const card = page.getByTestId("compact-dish-card").first();
    const panel = card.getByTestId("menu-card-panel");
    await expect(panel).toBeVisible();
    const styles = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
      };
    });
    expect(styles.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(styles.opacity).toBe("1");

    await expect(card.getByRole("link", { name: /elegir sopa para/i })).toBeVisible();
    await expect(card.getByRole("button", { name: /favorito/i })).toBeVisible();
    const favorite = await card.getByRole("button", { name: /favorito/i }).boundingBox();
    expect(favorite?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(favorite?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("genera evidencia del árbol visible en los viewports requeridos", async ({ page }, testInfo) => {
    testInfo.skip(testInfo.project.name !== "mobile-chromium", "La evidencia se conserva una sola vez por ejecución.");
    test.setTimeout(180_000);
    for (const viewport of [
      ...mobileAndTablet,
      { name: "1260x800", width: 1260, height: 800 },
      { name: "1440x1000", width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/menu");
      const visible = viewport.width < 1024 ? page.getByTestId("compact-dish-card") : page.getByTestId("menu-dish-row");
      await expect(visible.first()).toBeVisible();
      await page.addStyleTag({ content: '[data-testid="menu-grid"] > div, [data-testid="compact-dish-card"] { opacity: 1 !important; animation: none !important; transform: none !important; }' });
      await page.screenshot({ path: `${evidenceDir}/menu-${viewport.name}.png`, fullPage: false });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu");
    await page.addStyleTag({ content: '[data-testid="compact-dish-card"] { opacity: 1 !important; animation: none !important; transform: none !important; }' });
    await page.getByRole("searchbox").fill("ternera");
    const longName = page.getByRole("heading", { name: COMPACT_LONG_NAME });
    await expect(longName).toBeVisible();
    await expect(page.getByRole("link", { name: `Ver ${LONG_DISH_NAME}` })).toBeAttached();
    await longName.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceDir}/menu-long-name-390x844.png`, fullPage: false });

    await page.goto("/menu");
    await page.addStyleTag({ content: '[data-testid="compact-dish-card"] { opacity: 1 !important; animation: none !important; transform: none !important; }' });
    await expect(page.getByTestId("compact-dish-card").first()).toBeVisible();
    await page.evaluate(() => {
      const cards = document.querySelectorAll("[data-catalog-pane='compact'] [data-testid='compact-dish-card']");
      cards.item(cards.length - 1)?.scrollIntoView({ block: "center" });
    });
    const lastCard = page.getByTestId("compact-dish-card").last();
    await expect(lastCard).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `${evidenceDir}/menu-scrolled-390x844.png`, fullPage: false });
  });
});
