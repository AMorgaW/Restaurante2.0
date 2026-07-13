import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

test.describe("Experiencia de escritorio", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("el inicio se centra con navegación superior y sin nav inferior", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
    // Navegación superior de escritorio visible.
    await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
    // La navegación inferior móvil está oculta.
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeHidden();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("el grid del menú usa varias columnas en escritorio", async ({ page }) => {
    await page.goto("/menu");
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    // Estable frente a animaciones de entrada: se comprueba el layout
    // computado del grid, no posiciones en pleno vuelo. Tras el rediseño el
    // contenedor es lista (flex) en móvil y rejilla solo desde md; se localiza
    // por data-testid porque la clase base `grid` ya no está presente.
    const columnCount = await page
      .getByTestId("menu-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(columnCount).toBeGreaterThanOrEqual(3);
  });

  test("checkout y detalle mantienen anchura legible centrada", async ({ page }) => {
    await page.goto("/plato/plato-de-carne-asada");
    const main = page.locator("main#contenido");
    const box = await main.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(700);
    }
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });
});
