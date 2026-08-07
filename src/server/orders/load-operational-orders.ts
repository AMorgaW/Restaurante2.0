import "server-only";

import { getResolvedDataMode } from "@/lib/env/server";
import { listOperationalOrders } from "@/server/orders/staff-operations";
import { StaffOrderError } from "@/server/orders/staff-errors";
import type { Order } from "@/types/order";

export type OperationalOrdersLoad =
  | { mode: "local" }
  | { mode: "supabase"; orders: Order[]; error: string | null };

/**
 * Carga pedidos operativos para shells staff. En local la UI usa Zustand;
 * en supabase lee PostgreSQL vía RLS (sin fallback).
 */
export async function loadOperationalOrdersForUi(): Promise<OperationalOrdersLoad> {
  if (getResolvedDataMode() !== "supabase") {
    return { mode: "local" };
  }
  try {
    const orders = await listOperationalOrders(80);
    return { mode: "supabase", orders, error: null };
  } catch (error) {
    const message =
      error instanceof StaffOrderError
        ? error.message
        : "No se pudieron cargar los pedidos.";
    return { mode: "supabase", orders: [], error: message };
  }
}
