import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

test.describe("Onboarding", () => {
  test("aparece en la primera visita y el CTA lleva al inicio", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: /bienvenida/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Encuentra el plato")).toBeVisible();

    await dialog.getByRole("button", { name: "Explorar menú" }).click();
    // Splash breve y desaparición de la bienvenida.
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
  });

  test("puede omitirse y la preferencia persiste tras recargar", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: /bienvenida/i });
    await dialog.getByRole("button", { name: "Omitir" }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: /bienvenida/i })).toHaveCount(0);
  });

  test("no aparece cuando ya fue vista", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué te gustaría comer hoy?" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: /bienvenida/i })).toHaveCount(0);
  });

  test("con reduced motion se muestra y funciona igualmente", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: /bienvenida/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Explorar menú" }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await context.close();
  });
});
