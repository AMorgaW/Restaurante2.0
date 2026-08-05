import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { skipOnboarding } from "./helpers";

async function enterOwnerPanel(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  const owner = page.getByRole("button", { name: /Propietario/i });
  if (await owner.count()) {
    await expect(owner).toBeVisible();
    await owner.click();
  }
  await expect(page.getByRole("heading", { name: "Administrador", exact: true })).toBeVisible();
}

test.describe("administrador e inventario local", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.startsWith("solo owner/admin")) {
      await page.addInitScript(() => {
        window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: "owner", overrides: {} }, version: 1 }));
      });
      await skipOnboarding(page);
      await enterOwnerPanel(page);
    }
  });

  test("dashboard destaca inventario, métricas, alertas y no reservas", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Inventario", exact: true })).toBeVisible();
    await expect(page.getByText("Prioridad operativa")).toBeVisible();
    await expect(page.getByText("Alertas de stock")).toBeVisible();
    await expect(page.getByText("Datos de demostración locales")).toBeVisible();
    await expect(page.getByText(/reservas/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Inventario", exact: true })).toBeVisible();
  });

  test("ruta protegida renderiza filtros, estados, imágenes temporales y acciones", async ({ page }) => {
    await page.getByRole("link", { name: "Inventario", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/inventario$/);
    await expect(page.getByRole("heading", { name: "Inventario", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Insumos", exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Carne de res" }).getByText("Disponible")).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "Costilla" }).getByText("Crítico")).toBeVisible();
    await expect(page.locator("img[alt='']").first()).toBeVisible();
    await expect(page.getByLabel("Buscar por nombre")).toBeVisible();
    await page.getByLabel("Buscar por nombre").fill("costilla");
    await expect(page.getByRole("heading", { name: "Costilla" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Carne de res" })).toHaveCount(0);
  });

  test("agrega, ingresa, ajusta, registra merma y desactiva localmente", async ({ page }) => {
    await page.goto("/admin/inventario");
    await page.getByRole("button", { name: "Agregar insumo" }).click();
    await page.getByLabel("Nombre del insumo").fill("Harina demo");
    const addDialog = page.getByRole("dialog", { name: "Agregar insumo" });
    await addDialog.getByLabel("Categoría").selectOption({ label: "Despensa" });
    await addDialog.getByLabel("Unidad").selectOption("g");
    await addDialog.getByLabel("Cantidad inicial").fill("0");
    await addDialog.getByLabel("Stock mínimo").fill("100");
    await addDialog.getByRole("button", { name: "Agregar insumo" }).click();
    const card = page.getByRole("article").filter({ hasText: "Harina demo" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Ingresar" }).click();
    await page.getByLabel(/Cantidad a ingresar/).fill("250");
    await page.getByRole("dialog", { name: "Ingresar cantidad" }).getByRole("button", { name: "Ingresar cantidad" }).click();
    await expect(card).toContainText("250 g");
    await card.getByRole("button", { name: "Ajustar" }).click();
    await page.getByLabel(/Nueva cantidad/).fill("200");
    await page.getByLabel("Motivo").fill("Conteo físico");
    await page.getByRole("dialog", { name: "Ajustar cantidad" }).getByRole("button", { name: "Ajustar cantidad" }).click();
    await expect(card).toContainText("200 g");
    await card.getByRole("button", { name: "Merma" }).click();
    await page.getByLabel(/Cantidad de merma/).fill("20");
    await page.getByLabel("Motivo").fill("Producto dañado");
    await page.getByRole("dialog", { name: "Registrar merma" }).getByRole("button", { name: "Registrar merma" }).click();
    await expect(card).toContainText("180 g");
    await card.getByRole("button", { name: /Desactivar Harina demo/ }).click();
    await expect(card.getByText("Inactivo")).toBeVisible();
  });

  test("solo owner/admin reciben inventario y no hay overflow en tamaños aprobados", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/");
    await page.evaluate(() => window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: "editor", overrides: {} }, version: 1 })));
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Inventario", exact: true })).toHaveCount(0);
    await page.goto("/admin/inventario");
    await expect(page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();

    await page.evaluate(() => window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: "admin", overrides: {} }, version: 1 })));
    await page.goto("/admin/inventario");
    for (const width of [320, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await expect(page.getByRole("heading", { name: "Insumos", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test("consola, errores de página y accesibilidad quedan limpios", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: "owner", overrides: {} }, version: 1 }));
    });
    await page.goto("/admin/inventario");
    await expect(page.getByRole("heading", { name: "Inventario", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
  });
});

test.describe("inventario con reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("no oculta contenido ni rompe los controles", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: "owner", overrides: {} }, version: 1 }));
    });
    await skipOnboarding(page);
    await enterOwnerPanel(page);
    await page.goto("/admin/inventario");
    await expect(page.getByRole("heading", { name: "Inventario", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar insumo" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("opacity", "1");
  });
});
