import { expect, test } from "@playwright/test";
import { SIMPLE_DISH_NAME, SIMPLE_DISH_SLUG, skipOnboarding } from "./helpers";

/**
 * Transición compartida tarjeta → detalle (escena 7). El morph nativo de
 * View Transitions es visual; aquí se validan las señales OBSERVABLES que lo
 * hacen posible y estable: cada `view-transition-name: dish-<slug>` es único
 * dentro de un documento (sin él, el navegador no puede emparejar old↔new sin
 * duplicar la imagen), la navegación directa funciona y el viaje ida/vuelta
 * no rompe historial ni consola.
 */
async function dishViewTransitionNames(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const names: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const name = getComputedStyle(el).viewTransitionName;
      if (name && name !== "none") names.push(name);
    }
    return names.filter((name) => name.startsWith("dish-"));
  });
}

test.describe("Transición tarjeta → detalle", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("los view-transition-name de plato son únicos en el listado y en el detalle", async ({
    page,
  }) => {
    await page.goto("/menu");
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
    const listNames = await dishViewTransitionNames(page);
    expect(listNames.length).toBeGreaterThan(0);
    expect(new Set(listNames).size, `duplicados en /menu: ${listNames.join(", ")}`).toBe(
      listNames.length,
    );

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
    const homeNames = await dishViewTransitionNames(page);
    expect(homeNames.length).toBeGreaterThan(0);
    expect(new Set(homeNames).size, `duplicados en /: ${homeNames.join(", ")}`).toBe(
      homeNames.length,
    );

    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
    const detailNames = await dishViewTransitionNames(page);
    // El héroe comparte el nombre del plato abierto y aparece una sola vez
    // (los relacionados llevan slugs distintos: getRelatedItems excluye el
    // propio plato).
    expect(detailNames.filter((name) => name === `dish-${SIMPLE_DISH_SLUG}`)).toHaveLength(1);
    expect(new Set(detailNames).size, `duplicados en detalle: ${detailNames.join(", ")}`).toBe(
      detailNames.length,
    );
  });

  test("abre desde la fila y vuelve sin romper historial ni consola", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !/favicon|third-party cookie/i.test(message.text())) {
        errors.push(message.text());
      }
    });

    await page.goto("/menu");
    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page).toHaveURL(new RegExp(`/plato/${SIMPLE_DISH_SLUG}`));
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
    // El héroe compartido queda visible tras asentarse el morph.
    await expect(
      page.getByRole("img", { name: `Fotografía de ${SIMPLE_DISH_NAME}` }).first(),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/menu$/);
    // El listado vuelve a estar interactivo (sin fotograma de transición
    // colgado que bloquee el control).
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
    await expect(page.getByRole("searchbox").first()).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("navegación directa por URL funciona sin transición previa", async ({ page }) => {
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
    await expect(page.getByTestId("detail-total")).toBeVisible();
  });
});
