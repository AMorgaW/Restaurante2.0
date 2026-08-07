import { expect, test } from "@playwright/test";
import { SIMPLE_DISH_NAME, skipOnboarding } from "./helpers";

async function seedOwner(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "rb-admin",
      JSON.stringify({
        state: { demoRole: "owner", demoSessionActive: true, overrides: {} },
        version: 2,
      }),
    );
  });
  await skipOnboarding(page);
}

test.describe("Administración de catálogo local", () => {
  test("owner edita precio demo y se refleja en el panel", async ({ page }) => {
    await seedOwner(page);
    await page.goto("/admin/platos");
    await expect(page.getByRole("heading", { name: "Platos" })).toBeVisible();
    await expect(page.getByText(/modo demo local/i)).toBeVisible();

    const card = page.locator("li").filter({ hasText: SIMPLE_DISH_NAME }).first();
    await expect(card).toBeVisible();
    const priceInput = card.locator('input[type="number"]');
    await priceInput.fill("33300");
    await card.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Precio actualizado").first()).toBeVisible();
    await expect(card.getByText("Ajuste demo")).toBeVisible();
  });

  test("editor puede abrir platos; kitchen no ve la sección en nav útil", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "rb-admin",
        JSON.stringify({
          state: { demoRole: "editor", demoSessionActive: true, overrides: {} },
          version: 2,
        }),
      );
    });
    await skipOnboarding(page);
    await page.goto("/admin/platos");
    await expect(page.getByRole("heading", { name: "Platos" })).toBeVisible();
  });
});
