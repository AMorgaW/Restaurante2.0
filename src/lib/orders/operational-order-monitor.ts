import type { AdminRole } from "@/lib/admin/authorization";
import type { FulfillmentType, OrderStatus } from "@/types/order";

/** Snapshot mínimo para polling (sin PII de cliente). */
export type OperationalOrderSnapshot = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  createdAt: string;
};

export const OPERATIONAL_ORDER_POLL_INTERVAL_MS = 15_000;
export const OPERATIONAL_ORDER_OBSERVED_LIMIT = 200;

/** Roles que reciben toast/aviso de pedidos pending nuevos. */
export function canReceivePendingOrderAlerts(role: AdminRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "manager" || role === "cashier";
}

/**
 * Roles que hacen polling de la cola (incluye kitchen para refrescar confirmed+,
 * sin toast de pending).
 */
export function canPollOperationalOrders(role: AdminRole | null | undefined): boolean {
  return (
    canReceivePendingOrderAlerts(role) ||
    role === "kitchen"
  );
}

export function countPendingAttention(orders: readonly OperationalOrderSnapshot[]): number {
  return orders.filter((order) => order.status === "pending").length;
}

export function fingerprintOrders(orders: readonly OperationalOrderSnapshot[]): string {
  return orders
    .map((order) => `${order.id}:${order.status}`)
    .sort()
    .join("|");
}

export function buildNewOrderToast(newOrders: readonly OperationalOrderSnapshot[]): {
  title: string;
  description?: string;
} {
  if (newOrders.length === 0) {
    return { title: "Pedidos actualizados" };
  }
  if (newOrders.length === 1) {
    const order = newOrders[0]!;
    const channel =
      order.fulfillmentType === "delivery"
        ? "Domicilio"
        : order.fulfillmentType === "local"
          ? "Mesa"
          : "Para llevar";
    return {
      title: `Nuevo pedido ${order.orderNumber}`,
      description: channel,
    };
  }
  return {
    title: `${newOrders.length} pedidos nuevos`,
    description: "Revisa la cola operativa.",
  };
}

export type MonitorTickInput = {
  orders: readonly OperationalOrderSnapshot[];
  observedIds: ReadonlySet<string>;
  baselineDone: boolean;
  /** Si false, no emite toasts (p. ej. kitchen refresh-only). */
  emitPendingAlerts: boolean;
};

export type MonitorTickResult = {
  baselineDone: boolean;
  observedIds: Set<string>;
  pendingCount: number;
  newOrders: OperationalOrderSnapshot[];
  shouldToast: boolean;
  shouldPlaySound: boolean;
  fingerprint: string;
  /** True si cambió el conjunto id:status (lista debe revalidarse). */
  queueChanged: boolean;
  previousFingerprint: string;
};

function pruneObservedIds(
  observed: ReadonlySet<string>,
  currentIds: ReadonlySet<string>,
  limit: number,
): Set<string> {
  const next = new Set<string>();
  for (const id of currentIds) {
    if (observed.has(id)) next.add(id);
  }
  for (const id of observed) {
    if (next.size >= limit) break;
    next.add(id);
  }
  for (const id of currentIds) {
    if (next.size >= limit) break;
    next.add(id);
  }
  return next;
}

/**
 * Procesa un snapshot de polling: baseline sin toasts; luego solo order_id nuevos.
 */
export function tickOperationalOrderMonitor(
  input: MonitorTickInput,
  previousFingerprint = "",
): MonitorTickResult {
  const pendingCount = countPendingAttention(input.orders);
  const fingerprint = fingerprintOrders(input.orders);
  const currentIds = new Set(input.orders.map((order) => order.id));
  const queueChanged = previousFingerprint !== "" && fingerprint !== previousFingerprint;

  if (!input.baselineDone) {
    const observedIds = pruneObservedIds(currentIds, currentIds, OPERATIONAL_ORDER_OBSERVED_LIMIT);
    return {
      baselineDone: true,
      observedIds,
      pendingCount,
      newOrders: [],
      shouldToast: false,
      shouldPlaySound: false,
      fingerprint,
      queueChanged: false,
      previousFingerprint: fingerprint,
    };
  }

  const newOrders = input.orders.filter((order) => !input.observedIds.has(order.id));
  const merged = new Set(input.observedIds);
  for (const order of newOrders) merged.add(order.id);
  const observedIds = pruneObservedIds(merged, currentIds, OPERATIONAL_ORDER_OBSERVED_LIMIT);

  const shouldToast = input.emitPendingAlerts && newOrders.length > 0;
  return {
    baselineDone: true,
    observedIds,
    pendingCount,
    newOrders,
    shouldToast,
    shouldPlaySound: shouldToast,
    fingerprint,
    queueChanged: queueChanged || newOrders.length > 0,
    previousFingerprint: fingerprint,
  };
}
