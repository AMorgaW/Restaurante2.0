import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  LONG_DISH_NAME,
  MODIFIER_DISH_SLUG,
  SIMPLE_DISH_NAME,
  SIMPLE_DISH_SLUG,
  addSimpleDishToCart,
  skipOnboarding,
} from "./helpers";

/**
 * Verificación de accesibilidad con axe-core en las páginas principales.
 * Fallan las violaciones críticas y serias; el resto se registra en el
 * reporte (TEST_REPORT.md).
 */
async function expectNoSeriousViolations(
  page: import("@playwright/test").Page,
  route: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    serious,
    `${route}: ${serious.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} nodos`).join("; ")}`,
  ).toEqual([]);
}

test.describe("Accesibilidad (axe)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  const routes: Array<{ path: string; ready: string }> = [
    { path: "/", ready: "Sabores del Sinú en cada bocado" },
    { path: "/menu", ready: "Menú" },
    { path: `/plato/${SIMPLE_DISH_SLUG}`, ready: SIMPLE_DISH_NAME },
    // Detalle con modificadores obligatorios (fieldsets radio/checkbox + badges).
    { path: `/plato/${MODIFIER_DISH_SLUG}`, ready: LONG_DISH_NAME },
    { path: "/sucursales", ready: "Sucursales" },
    { path: "/preguntas-frecuentes", ready: "Preguntas frecuentes" },
  ];

  for (const route of routes) {
    test(`sin violaciones críticas en ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      // El encabezado evita coincidir con enlaces ocultos de navegación.
      await expect(page.getByRole("heading", { name: route.ready }).first()).toBeVisible();
      const detailPanel = page.getByTestId("product-info-panel");
      if ((await detailPanel.count()) > 0) {
        await expect(detailPanel).toHaveCSS("opacity", "1");
      }
      // El detalle anima los chips de ingredientes (fade/pop); axe debe medir
      // el estado ASENTADO, no un fotograma intermedio con opacidad reducida.
      const ingredientChips = page.locator('[aria-labelledby="ingredientes-titulo"] li');
      if ((await ingredientChips.count()) > 0) {
        await expect(ingredientChips.last()).toHaveCSS("opacity", "1");
      }
      await expectNoSeriousViolations(page, route.path);
    });
  }

  test("sin violaciones críticas en el carrito con productos", async ({ page }) => {
    await addSimpleDishToCart(page);
    await page.goto("/carrito");
    await expect(page.getByText(SIMPLE_DISH_NAME)).toBeVisible();
    await expectNoSeriousViolations(page, "/carrito");
  });

  test("sin violaciones críticas en el checkout", async ({ page }) => {
    await addSimpleDishToCart(page);
    await page.goto("/checkout");
    await expect(page.getByText("Finalizar pedido")).toBeVisible();
    await expectNoSeriousViolations(page, "/checkout");
  });

  test("el onboarding es accesible", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await expect(page.getByRole("button", { name: "Comenzar" }).locator("..")).toHaveCSS(
      "opacity",
      "1",
    );
    await expectNoSeriousViolations(page, "onboarding");
    await context.close();
  });
});
