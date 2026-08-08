"use server";

import { listOperationalOrders } from "@/server/orders/staff-operations";
import { StaffOrderError, toSafeStaffOrderMessage } from "@/server/orders/staff-errors";
import type { OperationalOrderSnapshot } from "@/lib/orders/operational-order-monitor";

export type PollOperationalOrdersResult =
  | { ok: true; orders: OperationalOrderSnapshot[] }
  | { ok: false; message: string; code: string };

/**
 * Lectura periódica de pedidos operativos. Solo SELECT vía listOperationalOrders
 * (sesión + RLS). No muta status/payment/inventory.
 */
export async function pollOperationalOrdersAction(): Promise<PollOperationalOrdersResult> {
  try {
    const orders = await listOperationalOrders(80);
    return {
      ok: true,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentType: order.fulfillmentType,
        createdAt: order.createdAt,
      })),
    };
  } catch (error) {
    if (!(error instanceof StaffOrderError)) {
      console.error("[order-poll] Error inesperado");
    }
    const safe = toSafeStaffOrderMessage(error);
    return { ok: false, message: safe.message, code: safe.code };
  }
}
