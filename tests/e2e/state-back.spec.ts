import { expect, test } from "@playwright/test";
import { SIMPLE_DISH_NAME, SIMPLE_DISH_SLUG, skipOnboarding } from "./helpers";

/**
 * Escena 8 — regreso y conservación de estado. Al abrir un plato y volver,
 * la persona regresa al MISMO contexto: ruta de origen, filtros de menú
 * (búsqueda/categoría/orden), posición de scroll vertical y listado
 * ASENTADO (sin re-animar ni mostrar skeletons falsos). El botón "Volver"
 * del detalle usa historial real y cae a /menu solo en entradas directas.
 * Las aserciones esperan señales observables, nunca sleeps largos.
 */
test.describe("Regreso y conservación de estado", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("conserva búsqueda, categoría, orden y scroll al volver (atrás del navegador)", async ({
    page,
  }) => {
    await page.goto("/menu");
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();

    // Estado de exploración: categoría + orden explícito + búsqueda.
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await page.selectOption("#menu-sort", "nombre");
    await page.getByRole("searchbox").first().fill("carne");
    await expect(page.getByRole("searchbox").first()).toHaveValue("carne");

    // Scroll vertical hasta bien entrado el listado (instantáneo: mouse.wheel
    // no existe en webkit móvil y el CSS usa scroll-behavior smooth).
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const yBefore = await page.evaluate(() => window.scrollY);

    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();

    // Búsqueda, categoría y orden intactos.
    await expect(page.getByRole("searchbox").first()).toHaveValue("carne");
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#menu-sort")).toHaveValue("nombre");

    // El scroll NO se reinicia al tope (tolerancia razonable respecto al
    // original; el navegador restaura hasta donde el contenido lo permite).
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 5_000 })
      .toBeGreaterThan(Math.min(yBefore - 120, 100));
  });

  test("favoritos → detalle → volver regresa a favoritos con el plato", async ({ page }) => {
    await page.addInitScript((slug) => {
      window.localStorage.setItem(
        "rb-favorites",
        JSON.stringify({ state: { slugs: [slug] }, version: 1 }),
      );
    }, SIMPLE_DISH_SLUG);

    await page.goto("/favoritos");
    await expect(page.getByRole("heading", { name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/favoritos$/);
    await expect(page.getByRole("heading", { name: SIMPLE_DISH_NAME })).toBeVisible();
  });

  test("URL directa: el botón Volver usa el fallback seguro a /menu", async ({ page }) => {
    // Sin historial interno previo (entrada directa), Volver no puede
    // retroceder a una página del sitio → fallback documentado a /menu.
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
  });

  test("el botón Volver interno regresa al listado conservando categoría", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("el listado no re-anima ni muestra skeletons falsos al volver", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
    // La tarjeta de origen ya está asentada (opacidad final) antes de abrir.
    const originCard = page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` });
    await expect(originCard).toBeVisible();

    await originCard.click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();

    // No aparece el contenedor de carga (skeletons) sin una carga real…
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    // …y las filas del grid están ASENTADAS (los envoltorios de motion,
    // hijos directos del grid, a opacidad 1: sin re-ejecutar el stagger de
    // entrada al volver, que arrancaría en opacidad 0).
    const grid = page.getByTestId("menu-grid");
    await expect(grid.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` })).toBeVisible();
    const rows = grid.locator("> div");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < rowCount; i += 1) {
      await expect(rows.nth(i)).toHaveCSS("opacity", "1");
    }
  });

  test("reduced motion: el estado se conserva y el contenido queda visible", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/menu");
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await page.getByRole("searchbox").first().fill("carne");

    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("searchbox").first()).toHaveValue("carne");
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const card = page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` });
    await expect(card).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });
});
