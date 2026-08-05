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
});
