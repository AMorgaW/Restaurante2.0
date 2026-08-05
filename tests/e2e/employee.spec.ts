import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS } from "@/lib/inventory/fixtures";
import { DEMO_RECIPES } from "@/lib/inventory/recipes";
import type { Order } from "@/types/order";

const makeOrder = (id: string, status: Order["status"], number: string): Order => ({
  id,
  orderNumber: number,
  branchId: "branch-centro",
  status,
  paymentStatus: "paid",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  items: [{ itemId: DEMO_RECIPES[0]!.productId, slug: DEMO_RECIPES[0]!.productId, nameSnapshot: "Plato demo", unitPrice: 43000, quantity: 1, modifiers: [], notes: "", total: 43000 }],
  totals: { subtotal: 43000, discount: 0, tax: 0, serviceFee: 0, deliveryFee: 0, tip: 0, total: 43000 },
  currency: "COP",
  customer: { name: "Cliente demo", phone: "3000000000", email: "demo@example.test" },
  notes: "",
  createdAt: "2026-08-04T12:00:00-05:00",
});

async function seed(page: Page, role: string, orders: Order[] = []) {
  await page.addInitScript(({ role: seededRole, seededOrders, items, movements, recipes }) => {
    window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: seededRole, overrides: {} }, version: 1 }));
    window.localStorage.setItem("rb-orders", JSON.stringify({ state: { orders: seededOrders }, version: 1 }));
    window.localStorage.setItem("rb-inventory-demo", JSON.stringify({ state: { items, movements, recipes, nextId: 1 }, version: 2 }));
  }, { role, seededOrders: orders, items: DEMO_INVENTORY_ITEMS, movements: DEMO_INVENTORY_MOVEMENTS, recipes: DEMO_RECIPES });
}

test("kitchen solo avanza confirmed → preparing → ready", async ({ page }) => {
  const order = makeOrder("employee-kitchen", "confirmed", "K-1");
  await seed(page, "kitchen", [order]);
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: /Hola, Juan/i })).toBeVisible();
  await page.getByRole("button", { name: "Preparar" }).click();
  await page.getByRole("button", { name: "Marcar listo" }).click();
  await expect(page.getByText("Estado terminal")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Entregar" })).toHaveCount(0);
  const inventory = await page.evaluate(() => JSON.parse(window.localStorage.getItem("rb-inventory-demo") ?? "{}"));
  expect(inventory.state.movements.filter((movement: { orderId?: string; type: string }) => movement.orderId === order.id && movement.type === "consumption")).toHaveLength(0);
});

test("cashier confirma y entrega una sola vez con consumo de inventario", async ({ page }) => {
  const pending = makeOrder("employee-cashier-pending", "pending", "C-1");
  const ready = makeOrder("employee-cashier-ready", "ready", "C-2");
  await seed(page, "cashier", [ready, pending]);
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: /Hola, Camila/i })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByRole("button", { name: "Entregar" }).click();
  await expect(page.getByText("Estado terminal")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entregar" })).toHaveCount(0);
  const inventory = await page.evaluate(() => JSON.parse(window.localStorage.getItem("rb-inventory-demo") ?? "{}"));
  expect(inventory.state.movements.filter((movement: { orderId?: string; type: string }) => movement.orderId === ready.id && movement.type === "consumption").length).toBeGreaterThan(0);
});

test("support puede consultar incidencias, sin mutaciones", async ({ page }) => {
  await seed(page, "support", [makeOrder("employee-support", "pending", "S-1")]);
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: /Hola, Sofía/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cola de pedidos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Preparar|Confirmar|Entregar/ })).toHaveCount(0);
  await expect(page.getByLabel("Descripción")).toHaveCount(0);
  await expect(page.getByText(/puede consultar incidencias, pero no registrarlas/i)).toBeVisible();
});

test("editor ve catálogo y no cola ni inventario operativo", async ({ page }) => {
  await seed(page, "editor");
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: /Hola, Mateo/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Menú del día" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cola de pedidos" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Inventario operativo" })).toHaveCount(0);
});

test("customer o perfil ausente no entra por URL directa", async ({ page }) => {
  await seed(page, "customer");
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: "Acceso de empleado no disponible" })).toBeVisible();
});

test("manager conserva operación, menú, inventario rápido e incidencias", async ({ page }) => {
  await seed(page, "manager");
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: /Hola, Laura/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cola de pedidos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Menú del día" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inventario operativo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Incidencias" })).toBeVisible();
});

test("workspace empleado funciona en móvil, reduced motion y sin errores de consola", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, "manager");
  await page.goto("/empleado");
  await expect(page.getByRole("heading", { name: /Hola, Laura/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
  expect(errors).toEqual([]);
});
