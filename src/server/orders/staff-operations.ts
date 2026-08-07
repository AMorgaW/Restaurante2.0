import "server-only";

import { z } from "zod";
import {
  adminRoleCan,
  allowedOrderStatusTransitions,
  isAdminRole,
  type AdminRole,
} from "@/lib/admin/authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { getOrderRepository } from "@/server/repositories";
import { StaffOrderError } from "@/server/orders/staff-errors";
import type { Order, OrderStatus } from "@/types/order";

const STATUS_VALUES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

const updateStatusSchema = z.object({
  orderId: z.string().uuid("Identificador de pedido inválido."),
  expectedStatus: z.enum(STATUS_VALUES),
  nextStatus: z.enum(STATUS_VALUES),
});

const STAFF_TRANSITION_ROLES = new Set<AdminRole>([
  "owner",
  "admin",
  "manager",
  "kitchen",
  "cashier",
]);

async function requireStaffOrderSession(capability: "read-orders" | "transition-orders") {
  if (getResolvedDataMode() !== "supabase") {
    throw new StaffOrderError(
      "Esta operación solo está disponible con DATA_MODE=supabase.",
      "data-mode",
    );
  }

  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.profile) {
    throw new StaffOrderError("Debes iniciar sesión para operar pedidos.", "unauthorized");
  }
  if (
    session.kind === "suspended_staff" ||
    session.profile.status === "suspended" ||
    session.profile.status === "inactive" ||
    session.profile.status === "invited"
  ) {
    throw new StaffOrderError("Tu cuenta de personal no está activa.", "forbidden");
  }
  if (!isAdminRole(session.profile.role) || !adminRoleCan(session.profile.role, capability)) {
    throw new StaffOrderError("Tu rol no permite esta operación de pedidos.", "forbidden");
  }
  if (capability === "transition-orders" && !STAFF_TRANSITION_ROLES.has(session.profile.role)) {
    throw new StaffOrderError("Tu rol no puede cambiar el estado de pedidos.", "forbidden");
  }

  return { session, role: session.profile.role };
}

/**
 * Lista pedidos visibles según RLS (staff por sucursal; customer solo propios).
 * Sin fallback a fixtures/Zustand.
 */
export async function listOperationalOrders(limit = 50): Promise<Order[]> {
  const { role } = await requireStaffOrderSession("read-orders");
  void role;
  try {
    return await getOrderRepository().listOrders({ limit });
  } catch {
    throw new StaffOrderError("No se pudieron cargar los pedidos.", "unavailable");
  }
}

/**
 * Transición de status con concurrencia optimista.
 * `ready → delivered` dispara `consume_order_inventory` en PostgreSQL (misma TX).
 */
export async function transitionOrderStatus(raw: unknown): Promise<Order> {
  const { role } = await requireStaffOrderSession("transition-orders");
  const parsed = updateStatusSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StaffOrderError(
      parsed.error.issues[0]?.message ?? "Los datos de la transición no son válidos.",
      "validation",
    );
  }

  const { orderId, expectedStatus, nextStatus } = parsed.data;

  if (nextStatus === expectedStatus) {
    throw new StaffOrderError("El pedido ya se encuentra en ese estado.", "invalid-transition");
  }

  const allowed = allowedOrderStatusTransitions(role, expectedStatus);
  if (!allowed.includes(nextStatus)) {
    throw new StaffOrderError("La transición de estado no está permitida para tu rol.", "invalid-transition");
  }

  const result = await getOrderRepository().updateOrderStatus({
    orderId,
    expectedStatus,
    nextStatus,
  });

  if (result.ok) return result.order;
  if (result.reason === "stale") {
    throw new StaffOrderError(
      "El pedido ya cambió de estado. Actualiza la vista e intenta de nuevo.",
      "stale-transition",
    );
  }
  if (result.reason === "forbidden") {
    throw new StaffOrderError("No tienes permiso para actualizar este pedido.", "forbidden");
  }
  throw new StaffOrderError("No encontramos ese pedido.", "not-found");
}
