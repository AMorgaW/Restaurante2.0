import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  LONG_DISH_NAME,
  MODIFIER_DISH_SLUG,
  SIMPLE_DISH_NAME,
  SIMPLE_DISH_SLUG,
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
    { path: "/", ready: "¿Qué te gustaría comer hoy?" },
    { path: "/menu", ready: "Menú" },
    { path: `/plato/${SIMPLE_DISH_SLUG}`, ready: SIMPLE_DISH_NAME },
    // Detalle con modificadores obligatorios (fieldsets radio/checkbox + badges).
    { path: `/plato/${MODIFIER_DISH_SLUG}`, ready: LONG_DISH_NAME },
    { path: "/reservar", ready: "Reserva tu mesa" },
    { path: "/sucursales", ready: "Sucursales" },
    { path: "/preguntas-frecuentes", ready: "Preguntas frecuentes" },
  ];

  for (const route of routes) {
    test(`sin violaciones críticas en ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      // El encabezado evita coincidir con enlaces ocultos de navegación.
      await expect(page.getByRole("heading", { name: route.ready }).first()).toBeVisible();
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
    await page.goto("/menu");
    await page.getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} al carrito` }).click();
    await page.goto("/carrito");
    await expect(page.getByText(SIMPLE_DISH_NAME)).toBeVisible();
    await expectNoSeriousViolations(page, "/carrito");
  });

  test("sin violaciones críticas en el checkout", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} al carrito` }).click();
    await page.goto("/checkout");
    await expect(page.getByText("Finalizar pedido")).toBeVisible();
    await expectNoSeriousViolations(page, "/checkout");
  });

  test("el onboarding es accesible", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /bienvenida/i })).toBeVisible();
    await expectNoSeriousViolations(page, "onboarding");
    await context.close();
  });
});
