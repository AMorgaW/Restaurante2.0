import { allowedOrderStatusTransitions, type AdminRole } from "@/lib/admin/authorization";
import { DEMO_RECIPES, hasActiveRecipe } from "@/lib/inventory/recipes";
import { getInventoryStatus } from "@/lib/inventory/selectors";
import type { InventoryItem } from "@/lib/inventory/types";
import { SERVICE_PERIOD_COPY, type ServicePeriod } from "@/lib/menu/service-period";
import type { MenuItem } from "@/types/menu";
import type { Order } from "@/types/order";
import type { EmployeeMetrics, EmployeeOrderFilter, EmployeeOrderView } from "@/lib/employee/types";

export function getEmployeeMetrics(orders: Order[]): EmployeeMetrics {
  return {
    newOrders: orders.filter((order) => order.status === "pending" || order.status === "confirmed").length,
    preparing: orders.filter((order) => order.status === "preparing").length,
    ready: orders.filter((order) => order.status === "ready").length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    deliveries: orders.filter((order) => order.fulfillmentType === "delivery" && !["delivered", "cancelled"].includes(order.status)).length,
    localOrders: orders.filter((order) => order.fulfillmentType === "pickup" && !["delivered", "cancelled"].includes(order.status)).length,
  };
}

export function getEmployeeOrderViews(orders: Order[], role: AdminRole | null | undefined, observedAt: string): EmployeeOrderView[] {
  const now = new Date(observedAt).getTime();
  return orders
    .map((order) => ({
      order,
      elapsedMinutes: Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000)),
      channelLabel: order.fulfillmentType === "delivery" ? "Domicilio" as const : "Mostrador" as const,
      nextStatus: allowedOrderStatusTransitions(role, order.status)[0],
    }))
    .sort((left, right) => {
      const leftRank = left.order.status === "ready" ? 0 : left.order.status === "preparing" ? 1 : left.order.status === "pending" ? 2 : 3;
      const rightRank = right.order.status === "ready" ? 0 : right.order.status === "preparing" ? 1 : right.order.status === "pending" ? 2 : 3;
      return leftRank - rightRank || right.elapsedMinutes - left.elapsedMinutes;
    });
}

export function filterEmployeeOrders(views: EmployeeOrderView[], filter: EmployeeOrderFilter): EmployeeOrderView[] {
  return views.filter(({ order }) => {
    if (filter === "all") return true;
    if (filter === "new") return order.status === "pending" || order.status === "confirmed";
    if (filter === "preparing") return order.status === "preparing";
    if (filter === "ready") return order.status === "ready";
    if (filter === "delivery") return order.fulfillmentType === "delivery";
    return order.fulfillmentType === "pickup";
  });
}

export function getEmployeeMenuItems(items: MenuItem[], period: ServicePeriod, inventoryItems: InventoryItem[]): Array<MenuItem & { recipePending: boolean; inventoryWarning: boolean }> {
  if (period === "closed") return [];
  return items.filter((item) => !item.categorySlug.includes("sopa")).slice(0, 8).map((item) => {
    const recipePending = !hasActiveRecipe(DEMO_RECIPES, item.id);
    const inventoryWarning = DEMO_RECIPES.find((recipe) => recipe.productId === item.id)?.items.some((ingredient) => {
      const inventoryItem = inventoryItems.find((candidate) => candidate.id === ingredient.inventoryItemId);
      return !inventoryItem || ["critical", "out", "inactive"].includes(getInventoryStatus(inventoryItem));
    }) ?? false;
    return { ...item, recipePending, inventoryWarning };
  });
}

export function getQuickInventoryItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => ["critical", "out"].includes(getInventoryStatus(item))).slice(0, 6);
}

export function servicePeriodLabel(period: ServicePeriod): string {
  return SERVICE_PERIOD_COPY[period].label;
}

export function statusLabel(status: string): string {
  return ({ pending: "Nuevo", confirmed: "Confirmado", preparing: "En preparación", ready: "Listo", delivered: "Entregado", cancelled: "Cancelado" } as Record<string, string>)[status] ?? status;
}
