import { describe, expect, it } from "vitest";
import { DEMO_INVENTORY_ITEMS } from "@/lib/inventory/fixtures";
import { getEmployeeMenuItems, getEmployeeMetrics, getEmployeeOrderViews, getQuickInventoryItems } from "@/lib/employee/selectors";
import { menuItems } from "@/data/menu";
import type { Order } from "@/types/order";

const order = (status: Order["status"], fulfillmentType: Order["fulfillmentType"] = "pickup"): Order => ({
  id: `employee-${status}-${fulfillmentType}`,
  orderNumber: "E-1",
  branchId: "branch-centro",
  status,
  paymentStatus: "paid",
  paymentMethod: "demo",
  fulfillmentType,
  items: [],
  totals: { subtotal: 0, discount: 0, tax: 0, serviceFee: 0, deliveryFee: 0, tip: 0, total: 0 },
  currency: "COP",
  customer: { name: "Demo", phone: "3000000000", email: "demo@example.test" },
  notes: "",
  createdAt: "2026-08-04T12:00:00-05:00",
});

describe("selectores de empleado", () => {
  it("deriva métricas y transiciones desde pedidos existentes", () => {
    const orders = [order("pending", "delivery"), order("preparing"), order("ready"), order("delivered", "delivery")];
    expect(getEmployeeMetrics(orders)).toEqual({ newOrders: 1, preparing: 1, ready: 1, delivered: 1, deliveries: 1, localOrders: 2 });
    expect(getEmployeeOrderViews(orders, "kitchen", "2026-08-04T12:30:00-05:00").find((view) => view.order.status === "preparing")?.nextStatus).toBe("ready");
  });

  it("marca receta pendiente y alerta de inventario sin duplicar fixtures", () => {
    const items = getEmployeeMenuItems(menuItems, "lunch", DEMO_INVENTORY_ITEMS);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => !item.categorySlug.includes("sopa"))).toBe(true);
    expect(items.some((item) => item.recipePending)).toBe(true);
  });

  it("limita inventario rápido a críticos y agotados", () => {
    const items = getQuickInventoryItems(DEMO_INVENTORY_ITEMS);
    expect(items.map((item) => item.id)).toEqual(expect.arrayContaining(["inv-costilla", "inv-leche"]));
    expect(items.every((item) => item.quantity <= item.minimumQuantity / 2)).toBe(true);
  });
});
