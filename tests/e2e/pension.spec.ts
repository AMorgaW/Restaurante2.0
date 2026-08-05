import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const balances = { "membership-active": 22, "membership-suspended": 12, "membership-expired": 0, "membership-cancelled": 4 };

async function seedProfile(page: Page, profileId: string): Promise<void> {
  await page.addInitScript(({ selectedProfileId, initialBalances }) => {
    window.localStorage.removeItem("rb-admin");
    window.localStorage.setItem("rb-pension", JSON.stringify({ state: { selectedProfileId, consumptions: [], mealBalances: initialBalances }, version: 1 }));
  }, { selectedProfileId: profileId, initialBalances: balances });
}

test.describe("experiencia local del pensionado", () => {
  test("customer sin membresía ve precio público y pago presencial, sin activar", async ({ page }) => {
    await seedProfile(page, "customer-no-membership");
    await page.goto("/pensionado");
    await expect(page.getByRole("heading", { name: /Conoce el plan pensionado/i })).toBeVisible();
    await expect(page.getByText(/Precio p.blico demo/i)).toBeVisible();
    await expect(page.getByText(/pago y la activaci.n se realizan personalmente con el jefe/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar consumo/i })).toHaveCount(0);
    await expect(page.getByText(/activar beneficios/i)).toHaveCount(0);
  });

  test("pending muestra espera y no permite consumir", async ({ page }) => {
    await seedProfile(page, "customer-pending");
    await page.goto("/pensionado");
    await expect(page.getByText(/Pendiente de activaci.n/i).first()).toBeVisible();
    await expect(page.getByText(/El jefe debe activar personalmente/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar consumo/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Consultar men.*general/i })).toBeVisible();
  });

  test("active selecciona almuerzo, confirma consumo y rechaza repetición", async ({ page }) => {
    await seedProfile(page, "customer-active");
    await page.goto("/pensionado");
    await expect(page.getByRole("heading", { name: /Arma tu comida/i })).toBeVisible();
    await page.locator('input[type="radio"][name="pension-main"]').first().check();
    await page.locator('input[type="radio"][name="pension-soup"]').first().check();
    const confirm = page.getByRole("button", { name: /Confirmar consumo demo/i });
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText(/Consumo demo confirmado/i)).toBeVisible();

    await page.locator('input[type="radio"][name="pension-main"]').first().check();
    await page.locator('input[type="radio"][name="pension-soup"]').first().check();
    await confirm.click();
    await expect(page.getByText(/Ya existe un consumo para este periodo/i)).toBeVisible();
    await expect(page.locator("#consumos")).toContainText("Aplicado");
  });

  test("muestra excedente y bloquea estados no activos", async ({ page }) => {
    await seedProfile(page, "customer-active");
    await page.goto("/pensionado");
    await page.locator('input[type="radio"][name="pension-main"]').nth(1).check();
    await page.locator('input[type="radio"][name="pension-soup"]').first().check();
    await expect(page.getByText(/Excedente/).first()).toBeVisible();
    await seedProfile(page, "customer-suspended");
    await page.goto("/pensionado");
    await expect(page.getByText(/Beneficios suspendidos/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar consumo/i })).toHaveCount(0);
  });

  test("vencido y cancelado conservan historial sin beneficios", async ({ page }) => {
    await seedProfile(page, "customer-expired");
    await page.goto("/pensionado");
    await expect(page.getByText(/Plan vencido/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Calendario demo/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar consumo/i })).toHaveCount(0);

    await seedProfile(page, "customer-cancelled");
    await page.goto("/pensionado");
    await expect(page.getByText(/Membresía cancelada/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Calendario demo/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar consumo/i })).toHaveCount(0);
  });

  test("fecha no publicada y servicio cerrado son estados explícitos", async ({ page }) => {
    await seedProfile(page, "customer-active");
    await page.goto("/pensionado");
    await page.getByLabel("Fecha del menú").selectOption("2026-08-05");
    await expect(page.getByText(/men.*todav.a no est.*publicado/i)).toBeVisible();
    await page.getByLabel("Fecha del menú").selectOption("2026-08-06");
    await expect(page.getByText(/Servicio cerrado/i)).toBeVisible();
  });

  test("pensionado se mantiene usable en móvil, teclado, reduced motion y axe", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await seedProfile(page, "customer-active");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/pensionado");
    await expect(page.getByRole("heading", { name: /Arma tu comida/i })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    for (const width of [320, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await expect(page.getByRole("heading", { name: /Arma tu comida/i })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
