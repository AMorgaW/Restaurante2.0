import { expect, test } from "@playwright/test";
import { DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS } from "@/lib/inventory/fixtures";
import { DEMO_RECIPES } from "@/lib/inventory/recipes";
import type { Order } from "@/types/order";

const order: Order = {
  id: "order-e2e-inventory",
  orderNumber: "CB-E2E-1",
  branchId: "branch-centro",
  status: "confirmed",
  paymentStatus: "paid",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  items: [{ itemId: DEMO_RECIPES[0]!.productId, slug: DEMO_RECIPES[0]!.productId, nameSnapshot: "Plato con receta demo", unitPrice: 43000, quantity: 1, modifiers: [], notes: "", total: 43000 }],
  totals: { subtotal: 43000, discount: 0, tax: 0, serviceFee: 0, deliveryFee: 0, tip: 0, total: 43000 },
  currency: "COP",
  customer: { name: "Cliente E2E", phone: "3000000000", email: "cliente@example.test" },
  notes: "",
  createdAt: "2026-08-04T12:00:00-05:00",
};

test("pedido local consume inventario solo al llegar a entregado", async ({ page }) => {
  await page.addInitScript(({ seededOrder, items, movements, recipes }) => {
    if (!window.localStorage.getItem("rb-onboarding")) window.localStorage.setItem("rb-onboarding", JSON.stringify({ state: { seen: true }, version: 1 }));
    if (!window.localStorage.getItem("rb-admin")) window.localStorage.setItem("rb-admin", JSON.stringify({ state: { demoRole: "owner", overrides: {} }, version: 1 }));
    if (!window.localStorage.getItem("rb-orders")) window.localStorage.setItem("rb-orders", JSON.stringify({ state: { orders: [seededOrder] }, version: 1 }));
    if (!window.localStorage.getItem("rb-inventory-demo")) window.localStorage.setItem("rb-inventory-demo", JSON.stringify({ state: { items, movements, recipes, nextId: 1 }, version: 2 }));
  }, { seededOrder: order, items: DEMO_INVENTORY_ITEMS, movements: DEMO_INVENTORY_MOVEMENTS, recipes: DEMO_RECIPES });

  await page.goto("/admin/pedidos");
  await expect(page.getByRole("heading", { name: "Pedidos", exact: true })).toBeVisible();
  const transition = page.locator(`#estado-${order.id}`);
  await transition.selectOption("preparing");
  await transition.selectOption("ready");
  await transition.selectOption("delivered");
  const orderCard = page.getByRole("listitem").filter({ hasText: order.orderNumber });
  await expect(orderCard.getByText("Entregado", { exact: true })).toBeVisible();

  const readConsumption = async () => page.evaluate(() => JSON.parse(window.localStorage.getItem("rb-inventory-demo") ?? "{}"));
  await expect.poll(async () => (await readConsumption()).state.movements.filter((movement: { orderId?: string; type: string }) => movement.orderId === "order-e2e-inventory" && movement.type === "consumption").length).toBe(3);
  await page.reload();
  await expect.poll(async () => (await readConsumption()).state.movements.filter((movement: { orderId?: string; type: string }) => movement.orderId === "order-e2e-inventory" && movement.type === "consumption").length).toBe(3);
});
