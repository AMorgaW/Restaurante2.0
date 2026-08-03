import { expect, test } from "@playwright/test";
import {
  LONG_DISH_NAME,
  MODIFIER_DISH_SLUG,
  SIMPLE_DISH_NAME,
  SIMPLE_DISH_SLUG,
  skipOnboarding,
} from "./helpers";

test.describe("Detalle de plato", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.clock.install({ time: new Date("2026-07-21T12:00:00-05:00") });
  });

  test("abre desde la tarjeta y muestra el nombre completo sin truncar", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("link", { name: `Ver ${LONG_DISH_NAME}` }).click();
    await expect(page).toHaveURL(new RegExp(`/plato/${MODIFIER_DISH_SLUG}`));
    await expect(page.getByRole("heading", { level: 1, name: LONG_DISH_NAME })).toBeVisible();
    await expect(page.getByTestId("included-soup-selector")).toBeVisible();
  });

  test("volver conserva la categoría, la búsqueda y el scroll", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: "Carnes", exact: true }).click();
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    await page.getByRole("link", { name: `Ver ${SIMPLE_DISH_NAME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: SIMPLE_DISH_NAME })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("button", { name: "Carnes", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  });

  test("selecciona sopa o Sin sopa sin término, notas ni relacionados", async ({ page }) => {
    await page.goto(`/plato/${MODIFIER_DISH_SLUG}`);
    const firstSoup = page.getByRole("radio").filter({ hasNotText: "Sin sopa" }).first();
    await expect(firstSoup).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Sin sopa" }).click();
    await expect(page.getByTestId("detail-order-summary")).toContainText("Sin sopa");
    await expect(page.getByText(/término de la carne/i)).toHaveCount(0);
    await expect(page.getByText(/notas para la cocina/i)).toHaveCount(0);
    await expect(page.getByText(/también te puede gustar/i)).toHaveCount(0);
  });

  test("cantidad y sopa se reflejan en el carrito", async ({ page }) => {
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.getByRole("button", { name: "Añadir al carrito" }).click();
    await expect(page.getByText("Añadido al carrito")).toBeVisible();
    await page.goto("/carrito");
    await expect(page.getByText(SIMPLE_DISH_NAME)).toBeVisible();
    await expect(page.getByText(/sopa/i).first()).toBeVisible();
    await expect(page.getByLabel(`Cantidad de ${SIMPLE_DISH_NAME}`).getByText("2")).toBeVisible();
  });

  test("favorito persiste y aparece en /favoritos", async ({ page }) => {
    await page.goto(`/plato/${SIMPLE_DISH_SLUG}`);
    await page.getByRole("button", { name: `Añadir ${SIMPLE_DISH_NAME} a favoritos` }).click();
    await page.goto("/favoritos");
    await expect(page.getByRole("heading", { name: SIMPLE_DISH_NAME })).toBeVisible();
  });
});
