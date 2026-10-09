import { expect, test } from "@playwright/test";
import { SIMPLE_DISH_SLUG, skipOnboarding } from "./helpers";

/**
 * Las páginas principales no deben producir errores de consola ni
 * excepciones sin manejar (hidratación, claves duplicadas, imágenes…).
 */
const ROUTES = ["/", "/menu", `/plato/${SIMPLE_DISH_SLUG}`, "/carrito", "/admin"];

// Ruido conocido y ajeno a la aplicación (extensiones, favicons de devtools…).
const IGNORED = [/favicon/i, /third-party cookie/i];

test.describe("Consola limpia", () => {
  for (const route of ROUTES) {
    test(`sin errores de consola en ${route}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
          errors.push(`console.error: ${message.text()}`);
        }
      });

      await skipOnboarding(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("recarga de /menu con la visita de sesión no rompe la hidratación", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
        errors.push(`console.error: ${message.text()}`);
      }
    });

    await skipOnboarding(page);
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("rb-menu-grid-visited"))).toBe("1");

    errors.length = 0;
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);

    const rows = page.getByTestId("menu-grid").locator("> div");
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    const rowCount = await rows.count();
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      await expect(row).toHaveClass(/transform-none/);
      await expect(row).toHaveCSS("opacity", "1");
      await expect(row).toHaveCSS("transform", "none");
    }
  });

  test("/menu con movimiento reducido no rompe la hidratación", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !IGNORED.some((rx) => rx.test(message.text()))) {
        errors.push(`console.error: ${message.text()}`);
      }
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await skipOnboarding(page);
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);

    const rows = page.getByTestId("menu-grid").locator("> div");
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    await expect(rows.first()).toHaveCSS("opacity", "1");
    await expect(rows.first()).toBeVisible();
  });
});
