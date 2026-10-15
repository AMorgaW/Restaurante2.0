import { expect, type Page } from "@playwright/test";

/**
 * Marca la bienvenida como vista ANTES de cargar la página (los stores
 * persisten en localStorage con el formato de zustand/persist).
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "rb-onboarding",
      JSON.stringify({ state: { seen: true }, version: 1 }),
    );
  });
}

/** Tarjeta que el viewport está mostrando. En /menu móvil es la compacta. */
export function visibleMenuCard(page: Page) {
  return page.locator(
    "[data-testid='compact-dish-card']:visible, [data-testid='menu-dish-row']:visible",
  );
}

/**
 * Fotografía de la fila visible. En /menu de escritorio la compacta sigue
 * en el HTML, oculta, y no debe ganar el primer `img` de la grilla.
 */
export function visibleRowPhoto(page: Page) {
  return page.locator("[data-testid='menu-dish-row']:visible .menu-dish-photo img");
}

/** Pilotos históricos de fila: solo se ejercitan donde la fila sigue visible. */
export function motionRowCatalogPath(_page: Page): "/menu" | "/buscar" {
  return "/menu";
}

/** Fotografía de la tarjeta que está visible en cualquier presentación. */
export function visibleMenuPhoto(page: Page) {
  return page.locator(
    "[data-testid='compact-dish-card']:visible [data-compact-photo] img, [data-testid='menu-dish-row']:visible .menu-dish-photo img",
  );
}

/** Comprueba que no exista scroll horizontal global. */
export async function expectNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
}

/** Slug de un plato SIN modificadores (acción rápida disponible). */
export const SIMPLE_DISH_SLUG = "carne-asada-plato-con-cebolleta";
export const SIMPLE_DISH_NAME = "Carne asada plato con cebolleta";

/** Slug del plato con modificadores obligatorios. */
export const MODIFIER_DISH_SLUG =
  "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de";

export const LONG_DISH_NAME =
  "Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima";

/** Añade el plato simple recorriendo el contrato de almuerzo completo. */
export async function addSimpleDishToCart(
  page: Page,
  options: { soup?: "first" | "none"; service?: "lunch" | "dinner" } = {},
): Promise<void> {
  await page.clock.setFixedTime(
    new Date(`2026-07-21T${options.service === "dinner" ? "18:00:00" : "12:00:00"}-05:00`),
  );
  // Abrimos directamente el plato para que WebKit no compita con la
  // navegación animada del catálogo durante los flujos de checkout.
  await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
  if (options.service === "dinner") {
    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    await expect(page.getByText("Añadido al carrito").first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/plato/${SIMPLE_DISH_SLUG}$`));
    await page.waitForTimeout(250);
    return;
  }
  await expect(page.getByTestId("included-soup-selector")).toBeVisible();
  await page
    .getByRole("radio", { name: options.soup === "none" ? "Sin sopa" : /Sopa de/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Añadir al carrito" }).click();
  await expect(page.getByText("Añadido al carrito").first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/plato/${SIMPLE_DISH_SLUG}$`));
  await page.waitForTimeout(250);
}
