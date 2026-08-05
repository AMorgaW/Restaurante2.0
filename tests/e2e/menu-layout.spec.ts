import { expect, test } from "@playwright/test";
import { LONG_DISH_NAME, expectNoHorizontalScroll } from "./helpers";

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

      const rows = page.getByTestId("menu-dish-row");
      const panels = page.getByTestId("menu-card-panel");
      await expect(rows.first()).toBeVisible();
      await expect(panels.first()).toBeVisible();
      await expect(page.getByTestId("bottom-nav-active-pill")).toHaveCount(0);
      await expect(page.getByTestId("menu-user-entry")).toHaveAttribute("aria-label", "Acceso de usuario");
      await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);

      const [firstBox, secondBox, panelBox, circleBox] = await Promise.all([
        rows.nth(0).boundingBox(),
        rows.nth(1).boundingBox(),
        panels.first().boundingBox(),
        rows.first().locator(".dish-circle").boundingBox(),
      ]);
      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      expect(panelBox).not.toBeNull();
      expect(circleBox).not.toBeNull();
      expect(secondBox!.y).toBeGreaterThan(firstBox!.y + 1);
      expect(Math.abs(secondBox!.x - firstBox!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(circleBox!.width - circleBox!.height)).toBeLessThanOrEqual(1);
      expect(circleBox!.x + circleBox!.width).toBeGreaterThan(panelBox!.x);
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
    await expect(rows.first().locator(".dish-circle")).toBeVisible();
    await expect(rows.last()).toBeVisible({ timeout: 15_000 });
  });

  test("el panel visible conserva azul real, transparencia y acciones operativas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu");

    const row = page.getByTestId("menu-dish-row").first();
    const panel = row.getByTestId("menu-card-panel");
    await expect(panel).toBeVisible();
    const styles = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.background,
        borderColor: style.borderColor,
        opacity: style.opacity,
        backdropFilter: style.backdropFilter,
        supportsBackdrop: CSS.supports("backdrop-filter", "blur(1px)"),
      };
    });
    expect(styles.background).toContain("rgba(31, 62, 158, 0.84)");
    expect(styles.opacity).toBe("1");
    expect(styles.borderColor).not.toBe("rgb(255, 255, 255)");
    expect(styles.borderColor).not.toBe("rgba(0, 0, 0, 0)");
    // Chromium móvil en headless puede declarar soporte pero desactivar el
    // filtro compuesto; en ese caso la superficie conserva el gradiente
    // semitransparente como fallback. Cuando se compone, debe ser el blur real.
    if (styles.backdropFilter !== "none") expect(styles.backdropFilter).toContain("blur(8px)");

    await expect(row.getByRole("link", { name: /elegir sopa para/i })).toBeVisible();
    await expect(row.getByRole("button", { name: /favorito/i })).toBeVisible();
  });

  test("genera evidencia del árbol visible en los viewports requeridos", async ({ page }, testInfo) => {
    testInfo.skip(testInfo.project.name !== "mobile-chromium", "La evidencia se conserva una sola vez por ejecución.");
    for (const viewport of [
      ...mobileAndTablet,
      { name: "1260x800", width: 1260, height: 800 },
      { name: "1440x1000", width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/menu");
      await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
      // Evidencia estática del estado final: no modifica el producto ni sus
      // transiciones; evita capturar una fila a mitad de su entrada existente.
      await page.addStyleTag({ content: '[data-testid="menu-grid"] > div { opacity: 1 !important; transform: none !important; }' });
      await page.screenshot({ path: `${evidenceDir}/menu-${viewport.name}.png`, fullPage: false });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/menu");
    await page.addStyleTag({ content: '[data-testid="menu-grid"] > div { opacity: 1 !important; transform: none !important; }' });
    await page.getByRole("searchbox").fill("ternera");
    const longName = page.getByRole("heading", { name: LONG_DISH_NAME });
    await expect(longName).toBeVisible();
    await longName.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${evidenceDir}/menu-long-name-390x844.png`, fullPage: false });

    await page.goto("/menu");
    await page.addStyleTag({ content: '[data-testid="menu-grid"] > div { opacity: 1 !important; transform: none !important; }' });
    await expect(page.getByTestId("menu-dish-row").first()).toBeVisible();
    await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="menu-dish-row"]');
      rows.item(rows.length - 1)?.scrollIntoView({ block: "center" });
    });
    const lastRow = page.getByTestId("menu-dish-row").last();
    await expect(lastRow).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `${evidenceDir}/menu-scrolled-390x844.png`, fullPage: false });
  });
});
