import { expect, test } from "@playwright/test";

test.describe("retirada de reservas", () => {
  test("la ruta pública histórica devuelve 404 y no redirige a una reserva", async ({ page }) => {
    const response = await page.goto("/reservar");
    expect(response?.status()).toBe(404);
  });

  test("la navegación y administración no anuncian reservas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /reserv/i })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /reserv/i })).toHaveCount(0);
  });
});
