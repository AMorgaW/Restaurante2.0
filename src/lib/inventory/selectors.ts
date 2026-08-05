import { DEMO_ADMIN_METRICS } from "@/lib/inventory/fixtures";
import type { InventoryFilters, InventoryItem, InventoryMovement, InventoryStatus, InventorySummary } from "@/lib/inventory/types";
import type { Order } from "@/types/order";

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  available: "Disponible",
  low: "Bajo",
  critical: "Crítico",
  out: "Agotado",
  inactive: "Inactivo",
};

export function getInventoryStatus(item: Pick<InventoryItem, "active" | "quantity" | "minimumQuantity">): InventoryStatus {
  if (!item.active) return "inactive";
  const baseQuantity = "baseQuantity" in item && typeof item.baseQuantity === "number" ? item.baseQuantity : item.quantity;
  const minimumBaseQuantity = "minimumBaseQuantity" in item && typeof item.minimumBaseQuantity === "number" ? item.minimumBaseQuantity : item.minimumQuantity;
  if (baseQuantity <= 0) return "out";
  if (baseQuantity <= minimumBaseQuantity / 2) return "critical";
  if (baseQuantity < minimumBaseQuantity) return "low";
  return "available";
}

export function getInventoryStatusClass(status: InventoryStatus): string {
  return {
    available: "border-lime/60 bg-lime/10 text-lime",
    low: "border-warning/60 bg-warning/10 text-warning",
    critical: "border-orange-400/70 bg-orange-400/10 text-orange-300",
    out: "border-error/70 bg-error/10 text-error",
    inactive: "border-border-soft bg-white/5 text-muted",
  }[status];
}

function isToday(createdAt: string, now = new Date()): boolean {
  const created = new Date(createdAt);
  return created.toDateString() === now.toDateString();
}

export function getInventorySummary(items: InventoryItem[], movements: InventoryMovement[], now = new Date()): InventorySummary {
  const activeItems = items.filter((item) => item.active);
  return {
    active: activeItems.length,
    low: activeItems.filter((item) => getInventoryStatus(item) === "low").length,
    critical: activeItems.filter((item) => getInventoryStatus(item) === "critical").length,
    out: activeItems.filter((item) => getInventoryStatus(item) === "out").length,
    estimatedValue: activeItems.reduce((total, item) => total + (item.baseQuantity / 1000) * (item.costPerBaseUnit ?? ((item.unitCost ?? 0) / (item.unit === "kg" || item.unit === "L" ? 1000 : 1))), 0),
    consumptionToday: movements
      .filter((movement) => movement.type === "consumption" && isToday(movement.createdAt, now))
      .reduce((total, movement) => total + movement.quantity, 0),
    recentMovements: [...movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
  };
}

export function filterInventory(items: InventoryItem[], filters: InventoryFilters): InventoryItem[] {
  const query = filters.search.trim().toLocaleLowerCase("es");
  return items.filter((item) => {
    if (query && !`${item.name} ${item.category}`.toLocaleLowerCase("es").includes(query)) return false;
    if (filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.status !== "all" && getInventoryStatus(item) !== filters.status) return false;
    if (filters.activity === "active" && !item.active) return false;
    if (filters.activity === "inactive" && item.active) return false;
    return true;
  });
}

export function getAdminDashboardMetrics(orders: Order[]) {
  if (orders.length === 0) return DEMO_ADMIN_METRICS;
  return {
    ordersToday: orders.length,
    salesToday: orders.reduce((sum, order) => sum + order.totals.total, 0),
    pensionersActive: DEMO_ADMIN_METRICS.pensionersActive,
    pendingDeliveries: orders.filter((order) => order.fulfillmentType === "delivery" && !["delivered", "cancelled"].includes(order.status)).length,
  };
}

export function getMovementLabel(type: InventoryMovement["type"]): string {
  return {
    initial_balance: "Saldo inicial",
    purchase: "Entrada por compra",
    consumption: "Salida por pedido",
    adjustment: "Ajuste de inventario",
    waste: "Ajuste por merma",
    reversal: "Reversión de consumo",
  }[type];
}
