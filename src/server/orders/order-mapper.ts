import { branches } from "@/config/restaurant";
import type { CartItemModifierSelection, Order, OrderStatus, PaymentStatus } from "@/types/order";

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string | null;
  branch_id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  fulfillment_type: string;
  subtotal: number;
  discount: number;
  tax: number;
  service_fee: number;
  delivery_fee: number;
  tip: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address_snapshot: unknown;
  notes: string | null;
  created_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_snapshot: string;
  unit_price: number;
  quantity: number;
  modifiers_snapshot: unknown;
  notes: string | null;
  total: number;
};

export type BranchSlugRow = {
  id: string;
  slug: string;
};

const ORDER_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
]);

const PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "processing",
  "paid",
  "failed",
  "refunded",
  "cancelled",
]);

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.has(value);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.has(value);
}

export function mapBranchUuidToConfigId(
  branchUuid: string,
  slugByUuid: ReadonlyMap<string, string>,
): string {
  const slug = slugByUuid.get(branchUuid);
  if (!slug) return branchUuid;
  const configured = branches.find((branch) => branch.slug === slug);
  return configured?.id ?? branchUuid;
}

export function parseModifiersSnapshot(raw: unknown): CartItemModifierSelection[] {
  if (!Array.isArray(raw)) return [];
  const result: CartItemModifierSelection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (
      typeof row.groupId !== "string" ||
      typeof row.groupName !== "string" ||
      typeof row.optionId !== "string" ||
      typeof row.optionName !== "string" ||
      typeof row.priceSnapshot !== "number"
    ) {
      continue;
    }
    result.push({
      groupId: row.groupId,
      groupName: row.groupName,
      optionId: row.optionId,
      optionName: row.optionName,
      priceSnapshot: row.priceSnapshot,
    });
  }
  return result;
}

function parseAddress(raw: unknown): Order["address"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  if (typeof row.street !== "string") return undefined;
  return {
    street: row.street,
    details: typeof row.details === "string" ? row.details : "",
    neighborhood: typeof row.neighborhood === "string" ? row.neighborhood : "",
  };
}

function mapPaymentMethod(value: string): Order["paymentMethod"] {
  if (value === "stripe" || value === "mercadopago") return value;
  return "demo";
}

export function mapOrderRowsToOrders(
  orders: readonly OrderRow[],
  items: readonly OrderItemRow[],
  slugByUuid: ReadonlyMap<string, string>,
): Order[] {
  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((order) => {
    const lineItems = (itemsByOrder.get(order.id) ?? []).map((item) => ({
      itemId: item.menu_item_id,
      slug: item.menu_item_id,
      nameSnapshot: item.name_snapshot,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      modifiers: parseModifiersSnapshot(item.modifiers_snapshot),
      notes: item.notes ?? "",
      total: item.total,
    }));

    return {
      id: order.id,
      orderNumber: order.order_number,
      branchId: mapBranchUuidToConfigId(order.branch_id, slugByUuid),
      status: isOrderStatus(order.status) ? order.status : "pending",
      paymentStatus: isPaymentStatus(order.payment_status) ? order.payment_status : "pending",
      paymentMethod: mapPaymentMethod(order.payment_method),
      fulfillmentType: order.fulfillment_type === "delivery" ? "delivery" : "pickup",
      items: lineItems,
      totals: {
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        serviceFee: order.service_fee,
        deliveryFee: order.delivery_fee,
        tip: order.tip,
        total: order.total,
      },
      currency: order.currency,
      couponCode: order.coupon_code ?? undefined,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email,
      },
      address: parseAddress(order.address_snapshot),
      notes: order.notes ?? "",
      createdAt: order.created_at,
    };
  });
}
