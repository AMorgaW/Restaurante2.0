import type { Page } from "@playwright/test";

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
