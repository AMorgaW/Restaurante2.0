import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding, LONG_DISH_NAME } from "./helpers";

/**
 * Home editorial + catálogo /menu. Tras el rediseño visual el buscador,
 * los filtros locales y el contador viven en /menu (el home es editorial
 * y NO muestra el catálogo completo); la cobertura funcional de
 * búsqueda/categoría/orden se conserva apuntando a /menu.
 */
test.describe("Raíz y menú principal", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("mantiene la portada y navega al menú desde Comenzar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("landing-page")).toBeVisible();
    await page.getByRole("link", { name: "Comenzar" }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("heading", { name: "Menú", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
  });

  test("no hay scroll horizontal en 320, 390 y 430 px", async ({ page }) => {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.getByTestId("landing-page")).toBeVisible();
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

  test("separa las sopas incluidas y filtra las categorías de platos", async ({ page }) => {
    await page.goto("/menu");
    // Las sopas son acompañamientos del servicio, no una categoría del
    // catálogo de platos secos.
    await expect(page.getByRole("button", { name: "Sopas", exact: true })).toHaveCount(0);
    await expect(async () => {
      await page.getByRole("button", { name: "Carnes", exact: true }).click();
      await expect(page.getByText(/\d+ platos?/, { exact: true }).first()).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await expect(page.getByRole("heading", { name: /Carne asada/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sopa de maíz con arroz y frijoles" })).toHaveCount(0);

    await page.getByRole("button", { name: "Todas", exact: true }).click();
    await expect(page.getByText(/[2-9] platos/).first()).toBeVisible();
  });

  test("busca ignorando tildes y permite limpiar sin resultados", async ({ page }) => {
    await page.goto("/menu");
    const search = page.getByRole("searchbox").first();
    await search.fill("jalapeno");
    await expect(page.getByRole("heading", { name: LONG_DISH_NAME })).toBeVisible();

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
    // El dato canónico de ternera (LONG_DISH_NAME) es el menor precio y,
    // por tanto, debe aparecer primero tras ordenar ascendentemente.
    await expect(
      page.locator("article").first().getByRole("heading", { name: LONG_DISH_NAME }),
    ).toBeVisible();
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
