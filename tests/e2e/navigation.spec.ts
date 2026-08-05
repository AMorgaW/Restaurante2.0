import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, SIMPLE_DISH_NAME, skipOnboarding } from "./helpers";

test.describe("Menú sin navegación principal persistente", () => {
  test.beforeEach(async ({ page }) => skipOnboarding(page));

  test("no monta barra inferior ni deja espacio vacío", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
    await expect(page.getByTestId("bottom-nav-active-pill")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Menú", exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await expect(page.locator("article").last()).toBeVisible();
    expect(await expectNoHorizontalScroll(page)).toBe(true);
  });

  test("conserva buscador, categorías, recomendados y acciones contextuales", async ({ page }) => {
    // Esta prueba verifica la acción rápida de añadir en el contrato de
    // cena; en almuerzo el CTA correcto es "Elegir sopa".
    await page.clock.setFixedTime(new Date("2026-07-21T18:00:00-05:00"));
    await page.goto("/menu");
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.getByRole("group", { name: "Filtrar por categoría" })).toBeVisible();
    await expect(page.getByLabel("Ordenar por")).toHaveValue("recomendados");
    await page.getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} al carrito` }).click();
    await page.getByRole("link", { name: /ver carrito/i }).click();
    await expect(page).toHaveURL(/\/carrito$/);
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toHaveCount(0);
  });

  test("el panel visible de cada plato es azul y no usa borde blanco", async ({ page }) => {
    await page.goto("/menu");
    const panel = page.getByTestId("menu-card-panel").first();
    await expect(panel).toBeVisible();
    const styles = await panel.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.background,
        borderColor: computed.borderColor,
        opacity: computed.opacity,
      };
    });
    expect(styles.background).toContain("rgba(31, 62, 158, 0.84)");
    expect(styles.borderColor).not.toBe("rgb(255, 255, 255)");
    expect(styles.opacity).toBe("1");
  });
});
