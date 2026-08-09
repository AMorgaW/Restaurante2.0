import { expect, test, type Page } from "@playwright/test";

/** Navegación a sección denegada; WebKit+next dev puede interrumpir el primer goto. */
async function expectAdminDenied(page: Page, path: string) {
  await expect
    .poll(
      async () => {
        await page.goto(path, { waitUntil: "commit" }).catch(() => undefined);
        return page.url().includes(path);
      },
      { timeout: 20_000, intervals: [200, 500, 1000] },
    )
    .toBe(true);
  await expect(page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();
}

test.describe("Auth opcional en modo local", () => {
  test("permite continuar como invitado y no simula una sesion", async ({ page }) => {
    await page.goto("/login?next=https://evil.example");
    await expect(page.getByRole("heading", { name: /Iniciar sesi/ })).toBeVisible();
    await expect(page.getByText(/modo local/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Continuar como invitado" })).toHaveAttribute("href", "/menu");
    expect(new URL(page.url()).origin).toBe("http://localhost:3100");
  });

  test("la entrada de usuario conduce a la ruta interna de login", async ({ page }) => {
    await page.goto("/menu");
    await page.waitForLoadState("networkidle");
    const entry = page.getByRole("button", { name: "Iniciar sesión" });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });
  });

  test("admin local conserva la demostracion explicita", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText(/modo demostraci.n local/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Propietario" })).toBeVisible();
  });

  test("editor ve solo catalogo y el acceso directo a pedidos se deniega", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Editor" }).click();
    await expect(page.getByRole("link", { name: "Platos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Categor/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedidos", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sucursales", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Promociones", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Configur/ })).toHaveCount(0);
    await expectAdminDenied(page, "/admin/pedidos");
  });

  test("cocina y support no reciben acciones fuera de su matriz", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Cocina" }).click();
    await expect(page.getByRole("link", { name: "Pedidos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Configur/ })).toHaveCount(0);
    await expectAdminDenied(page, "/admin/configuracion");

    await page.evaluate(() => window.localStorage.removeItem("rb-admin"));
    await page.goto("/admin");
    await page.getByRole("button", { name: "Atencion" }).click();
    await page.getByRole("link", { name: "Pedidos", exact: true }).click();
    await expect(page.getByText(/no hay transiciones permitidas|a.n no hay pedidos/i).first()).toBeVisible();
  });
});
