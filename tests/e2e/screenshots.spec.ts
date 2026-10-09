import { expect, test } from "@playwright/test";
import { addSimpleDishToCart, MODIFIER_DISH_SLUG, skipOnboarding } from "./helpers";

/**
 * Capturas de revisión visual en los tamaños exigidos, guardadas en
 * artifacts/screenshots para inspección manual (ver TEST_REPORT.md).
 */
const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x1000", width: 1440, height: 1000 },
] as const;

const DIR = "artifacts/screenshots";

test.describe("Capturas de revisión visual", () => {
  // Recorre 8 viewports con capturas de página completa: necesita margen.
  test.slow();

  test("onboarding en tamaños clave", async ({ page }) => {
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3], VIEWPORTS[5], VIEWPORTS[7]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await expect(page.getByTestId("landing-page")).toBeVisible();
      await expect
        .poll(() =>
          page
            .getByRole("img", { name: /pescado frito/i })
            .evaluate((element) => (element as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.waitForTimeout(1100); // fin de la secuencia de entrada
      await page.screenshot({ path: `${DIR}/onboarding-${viewport.name}.png`, fullPage: false });
      await page.evaluate(() => window.localStorage.clear());
    }
  });

  test("menú tras completar y visita recurrente", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("link", { name: "Comenzar" }).click();
    await expect(page.getByRole("heading", { name: "Menú", exact: true })).toBeVisible();
    await page.screenshot({ path: `${DIR}/landing-menu-after-start-390x844.png`, fullPage: true });

    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await page.screenshot({ path: `${DIR}/landing-returning-390x844.png`, fullPage: true });
  });

  test("pantallas principales en todos los tamaños", async ({ page }) => {
    await skipOnboarding(page);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto("/");
      await expect(page.getByTestId("landing-page")).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${DIR}/landing-root-${viewport.name}.png`, fullPage: true });

      await page.goto("/menu");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/menu-${viewport.name}.png`, fullPage: true });
    }
  });

  test("detalle con nombre largo, carrito y checkout", async ({ page }) => {
    await skipOnboarding(page);
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3], VIEWPORTS[5], VIEWPORTS[7]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto(`/plato/${MODIFIER_DISH_SLUG}`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${DIR}/detalle-${viewport.name}.png`, fullPage: true });

      // Carrito con producto.
      await addSimpleDishToCart(page);
      await page.goto("/carrito");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/carrito-${viewport.name}.png`, fullPage: true });

      await page.goto("/checkout");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${DIR}/checkout-${viewport.name}.png`, fullPage: true });

    }
  });

  test("estados vacío, error 404 y offline", async ({ page }) => {
    await skipOnboarding(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/carrito");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/estado-vacio-390x844.png`, fullPage: true });

    await page.goto("/buscar");
    await page.getByRole("searchbox").first().fill("zzzz sin resultados");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/sin-resultados-390x844.png`, fullPage: true });

    await page.goto("/ruta-inexistente");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/error-404-390x844.png`, fullPage: true });

    await page.goto("/offline");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/offline-390x844.png`, fullPage: true });

    await page.goto("/favoritos");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/favoritos-vacio-390x844.png`, fullPage: true });
  });
});
