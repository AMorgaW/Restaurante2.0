import { expect, test } from "@playwright/test";

test.describe("login demo y destinos canónicos", () => {
  test("un único login dirige al administrador demo", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await page.getByRole("button", { name: "Administrador" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Datos de demostración locales")).toBeVisible();
  });

  test("un empleado demo llega al espacio operativo, no a administración", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Empleado" }).click();
    await expect(page).toHaveURL(/\/empleado$/);
    await expect(page.getByText("Empleado · demo local")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  });

  test("un cliente demo llega a pensionado y conserva el estado comercial", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Cliente" }).click();
    await expect(page).toHaveURL(/\/pensionado$/);
    await expect(page.getByText("Perfil demo local")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plan Pensionado Demo" })).toBeVisible();
  });

  test("el siguiente destino no acepta un host externo", async ({ page }) => {
    await page.goto("/login?next=https%3A%2F%2Fevil.example");
    await page.getByRole("button", { name: "Administrador" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page).not.toHaveURL(/evil\.example/);
  });

  test("logout demo limpia la identidad antes de volver a una ruta privada", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Cliente" }).click();
    await expect(page).toHaveURL(/\/pensionado$/);
    await page.getByRole("button", { name: "Salir de demo" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/pensionado");
    await expect(page.getByRole("heading", { name: "Acceso de cliente demo requerido" })).toBeVisible();
  });
});
