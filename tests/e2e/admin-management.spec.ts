import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

async function seedRole(page: import("@playwright/test").Page, role: string | null) {
  await page.addInitScript((seededRole) => {
    if (window.localStorage.getItem("__admin-flow-override") === "1") return;
    window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: seededRole, overrides: {} }, version: 1 }));
    window.localStorage.removeItem("rb-staff");
    window.localStorage.removeItem("rb-pension-admin");
    window.localStorage.removeItem("rb-pension");
  }, role);
  await skipOnboarding(page);
}

test.describe("sesión administrativa local", () => {
  test("owner gestiona empleados y sincroniza su cargo con /empleado", async ({ page }) => {
    await seedRole(page, "owner");
    await page.goto("/admin/empleados");
    await expect(page.getByRole("heading", { name: "Empleados" })).toBeVisible();
    const laura = page.getByRole("article").filter({ hasText: "Laura Gómez" });
    await laura.getByRole("button", { name: "Cambiar cargo" }).click();
    await page.getByLabel("Nuevo cargo").selectOption("cashier");
    await page.getByRole("button", { name: "Guardar cargo" }).click();
    await expect(laura).toContainText("Caja");
    await laura.getByRole("link", { name: "Abrir experiencia" }).click();
    await expect(page).toHaveURL(/\/empleado$/);
    await expect(page.getByRole("heading", { name: /Hola, Laura/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Caja · Casa Brasa Centro" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preparar" })).toHaveCount(0);
  });

  test("owner registra pago, activa y suspende una membresía, visible en pensionado", async ({ page }) => {
    await seedRole(page, "owner");
    await page.goto("/admin/pensionados");
    const pending = page.getByRole("article").filter({ hasText: "María pendiente" });
    await pending.getByRole("button", { name: "Registrar pago" }).click();
    await page.getByRole("dialog", { name: "Registrar pago presencial" }).getByRole("button", { name: "Guardar pago presencial" }).click();
    await pending.getByRole("button", { name: "Activar pensionado" }).click();
    const activation = page.getByRole("dialog", { name: "Activar pensionado" });
    await activation.getByLabel(/Confirmo el pago presencial/).evaluate((element) => (element as HTMLInputElement).click());
    await expect(activation.getByLabel(/Confirmo el pago presencial/)).toBeChecked();
    await activation.getByRole("button", { name: "Confirmar activación" }).click();
    await expect(pending.getByText("Activo")).toBeVisible();
    await expect(pending.getByRole("button", { name: "Suspender membresía" })).toBeVisible();
    await pending.getByRole("button", { name: "Suspender membresía" }).click();
    await page.getByRole("dialog", { name: "Suspender membresía" }).getByLabel("Razón").fill("Revisión demo");
    await page.getByRole("dialog", { name: "Suspender membresía" }).getByRole("button", { name: "Confirmar operación" }).click();
    await expect(pending.getByText("Suspendido")).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.setItem("__admin-flow-override", "1");
      window.localStorage.removeItem("rb-admin");
      window.localStorage.setItem("rb-pension", JSON.stringify({ state: { selectedProfileId: "customer-pending", consumptions: [], mealBalances: {} }, version: 1 }));
    });
    await page.reload();
    await page.goto("/pensionado");
    await expect(page.getByText("Beneficios suspendidos").first()).toBeVisible();
    const critical = await new AxeBuilder({ page }).analyze();
    expect(critical.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  });

  test("admin consulta sin mostrar acciones sensibles y el acceso sin rol queda cerrado", async ({ page }) => {
    await seedRole(page, "admin");
    await page.goto("/admin/pensionados");
    await expect(page.getByText("Consulta operativa")).toBeVisible();
    await expect(page.getByRole("button", { name: "Activar pensionado" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Suspender membresía" })).toHaveCount(0);
    await seedRole(page, null);
    await page.goto("/admin/empleados");
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Empleados" })).toHaveCount(0);
  });

  test("empleados y pensionados no generan overflow móvil ni errores de consola", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await seedRole(page, "owner");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/admin/empleados");
    await expect(page.getByRole("heading", { name: "Empleados" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/admin/pensionados");
    await expect(page.getByRole("heading", { name: "Pensionados" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});
