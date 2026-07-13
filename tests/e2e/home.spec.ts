import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding, LONG_DISH_NAME } from "./helpers";

/**
 * Home editorial + catálogo /menu. Tras el rediseño visual el buscador,
 * los filtros locales y el contador viven en /menu (el home es editorial
 * y NO muestra el catálogo completo); la cobertura funcional de
 * búsqueda/categoría/orden se conserva apuntando a /menu.
 */
test.describe("Inicio editorial", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("muestra saludo, accesos por categoría, protagonista y destacados", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Explorar por categoría" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Destacados" })).toBeVisible();
    // Protagonista: una tarjeta de plato dominante enlazando al detalle.
    await expect(page.locator("article").first().getByRole("link", { name: /^Ver / })).toBeVisible();
    // El home NO es el catálogo: sin buscador y sin los 6 platos.
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    const dishCards = await page.locator("article").count();
    expect(dishCards).toBeLessThan(6);
    // Puente hacia el menú completo con contador real.
    await expect(page.getByText(/\d+ platos? · /)).toBeVisible();
  });

  test("los accesos por categoría llevan a /menu con la categoría activa", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Explorar por categoría" }).waitFor();
    // Anti-carrera de hidratación: el clic solo cuenta cuando navega y el
    // contador filtrado confirma que la categoría quedó aplicada.
    await expect(async () => {
      await page.getByRole("link", { name: "Sopas", exact: true }).click();
      await expect(page).toHaveURL(/\/menu$/, { timeout: 2_000 });
      await expect(page.getByText("1 plato", { exact: true })).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await expect(
      page.getByRole("heading", { name: "Sopa de maíz con arroz y frijoles" }),
    ).toBeVisible();
  });

  test("no hay scroll horizontal en 320, 390 y 430 px", async ({ page }) => {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
      expect(await expectNoHorizontalScroll(page), `overflow en ${width}px`).toBe(true);
    }
  });
});

test.describe("Catálogo /menu", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("muestra buscador, categorías, contador y platos", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("searchbox").first()).toBeVisible();
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
    await expect(page.getByText(/\d+ platos?/).first()).toBeVisible();
  });

  test("filtra por categoría y conserva el contador", async ({ page }) => {
    await page.goto("/menu");
    // Mismo patrón anti-carrera de hidratación que el ordenamiento: el
    // clic solo cuenta cuando el contador reacciona.
    await expect(async () => {
      await page.getByRole("button", { name: "Sopas", exact: true }).click();
      await expect(page.getByText("1 plato", { exact: true })).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await expect(
      page.getByRole("heading", { name: "Sopa de maíz con arroz y frijoles" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Todas", exact: true }).click();
    await expect(page.getByText(/[2-9] platos/).first()).toBeVisible();
  });

  test("busca ignorando tildes y permite limpiar sin resultados", async ({ page }) => {
    await page.goto("/menu");
    const search = page.getByRole("searchbox").first();
    await search.fill("maiz");
    await expect(
      page.getByRole("heading", { name: "Sopa de maíz con arroz y frijoles" }),
    ).toBeVisible();

    await search.fill("pizza inexistente");
    await expect(page.getByText("No encontramos platos con esa búsqueda")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByText(/\d+ platos?/).first()).toBeVisible();
  });

  test("los nombres largos se muestran sin desbordar la tarjeta", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/menu");
    // El plato de nombre más largo es el destacado (bloque editorial que
    // muestra su nombre corto); al buscarlo baja a la lista como MenuDishRow,
    // que muestra el nombre COMPLETO en el encabezado (line-clamp-2, altura
    // estable): el escenario real de un nombre largo dentro de una tarjeta.
    const search = page.getByRole("searchbox").first();
    const heading = page.getByRole("heading", { name: LONG_DISH_NAME });
    // Mismo patrón anti-carrera de hidratación que el ordenamiento: el input
    // es controlado; si el texto se escribe antes de que React hidrate, el
    // valor se revierte. Se reintenta hasta que la búsqueda PERSISTA.
    await expect(async () => {
      await search.fill("ternera");
      await expect(heading).toBeVisible({ timeout: 2_000 });
    }).toPass();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("la página /menu ofrece ordenamiento", async ({ page }) => {
    await page.goto("/menu");
    const sortSelect = page.getByLabel("Ordenar por");
    // El select es controlado: si la selección ocurre antes de que React
    // hidrate (webkit es más lento), el valor se revierte. Se reintenta
    // hasta que el valor PERSISTA — evidencia observable de hidratación.
    await expect(async () => {
      await sortSelect.selectOption("precio-asc");
      await expect(sortSelect).toHaveValue("precio-asc");
    }).toPass();
    // Con precio ascendente, la segunda tarjeta es la ternera ($43.000):
    // distingue el orden nuevo del orden por defecto (la sopa encabeza ambos).
    await expect(page.locator("article").nth(1)).toContainText("43.000");
    const prices = await page
      .locator("article")
      .locator("span.tabular-nums")
      .allInnerTexts();
    const numeric = prices
      .map((price) => Number.parseInt(price.replace(/[^\d]/g, ""), 10))
      .filter((value) => Number.isFinite(value) && value > 0);
    const sorted = [...numeric].sort((a, b) => a - b);
    expect(numeric).toEqual(sorted);
  });

  test("las categorías tienen URL propia", async ({ page }) => {
    await page.goto("/menu/carnes");
    await expect(page.getByRole("heading", { name: "Carnes", exact: true })).toBeVisible();
    await expect(page.getByText(/\d+ platos?/).first()).toBeVisible();
  });
});
