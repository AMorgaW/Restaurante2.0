import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

async function openDemoLogin(page: import("@playwright/test").Page) {
  await skipOnboarding(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
}

test.describe("login demo y destinos canónicos", () => {
  test("un único login dirige al administrador demo", async ({ page }) => {
    await openDemoLogin(page);
    const admin = page.getByRole("button", { name: "Administrador" });
    await expect(admin).toBeEnabled();
    await Promise.all([page.waitForURL(/\/admin$/), admin.click()]);
    await expect(page.getByText("Datos de demostración locales")).toBeVisible();
  });

  test("un empleado demo llega al espacio operativo, no a administración", async ({ page }) => {
    await openDemoLogin(page);
    const employee = page.getByRole("button", { name: "Empleado" });
    await expect(employee).toBeEnabled();
    await Promise.all([page.waitForURL(/\/empleado$/), employee.click()]);
    await expect(page.getByText("Empleado · demo local")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  });

  test("un cliente demo llega a pensionado y conserva el estado comercial", async ({ page }) => {
    await openDemoLogin(page);
    const customer = page.getByRole("button", { name: "Cliente" });
    await expect(customer).toBeEnabled();
    await Promise.all([page.waitForURL(/\/pensionado$/), customer.click()]);
    await expect(page.getByText("Perfil demo local")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plan mensual" })).toBeVisible();
  });

  test("el siguiente destino no acepta un host externo", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/login?next=https%3A%2F%2Fevil.example");
    const admin = page.getByRole("button", { name: "Administrador" });
    await expect(admin).toBeEnabled();
    await Promise.all([page.waitForURL(/\/admin$/), admin.click()]);
    await expect(page).not.toHaveURL(/evil\.example/);
  });

  test("logout demo limpia la identidad antes de volver a una ruta privada", async ({ page }) => {
    await openDemoLogin(page);
    const customer = page.getByRole("button", { name: "Cliente" });
    await expect(customer).toBeEnabled();
    await Promise.all([page.waitForURL(/\/pensionado$/), customer.click()]);
    await page.getByRole("button", { name: "Salir de demo" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/pensionado");
    await expect(page.getByRole("heading", { name: "Acceso de cliente demo requerido" })).toBeVisible();
  });
});
