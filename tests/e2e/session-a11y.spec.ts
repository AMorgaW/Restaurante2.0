import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectAccessible(page: import("@playwright/test").Page, route: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(serious, `${route}: ${serious.map((violation) => violation.id).join(", ")}`).toEqual([]);
}

test.describe("sesión y destinos: accesibilidad", () => {
  test("login, cuenta y destino demo mantienen foco y axe limpio", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expectAccessible(page, "/login");
    await page.getByRole("button", { name: "Cliente" }).click();
    await expect(page).toHaveURL(/\/pensionado$/);
    await expectAccessible(page, "/pensionado");
    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: "Mi cuenta" })).toBeVisible();
    await expectAccessible(page, "/cuenta");
  });
});
