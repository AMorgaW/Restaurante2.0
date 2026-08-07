import "server-only";

import { z } from "zod";
import { adminRoleCan, isAdminRole } from "@/lib/admin/authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseOperations } from "@/server/repositories/supabase-operations";
import { displayQuantityToBaseDelta, mapInventoryItemRow, type InventoryItemRow } from "@/server/inventory/mapper";
import { QUANTITY_SCALE } from "@/lib/inventory/units";
import type { InventoryUnit } from "@/lib/inventory/types";

export type InventoryStaffErrorCode =
  | "unauthorized"
  | "forbidden"
  | "data-mode"
  | "validation"
  | "not-found"
  | "insufficient-stock"
  | "persist";

export class InventoryStaffError extends Error {
  constructor(
    message: string,
    public readonly code: InventoryStaffErrorCode,
  ) {
    super(message);
    this.name = "InventoryStaffError";
  }
}

const movementSchema = z.object({
  itemId: z.string().uuid("Identificador de insumo inválido."),
  action: z.enum(["receive", "adjust", "waste"]),
  quantity: z.number().finite(),
  reason: z.string().trim().min(1, "El motivo es obligatorio.").max(240),
  idempotencyKey: z.string().uuid("Clave de idempotencia inválida."),
});

async function requireInventoryManager() {
  if (getResolvedDataMode() !== "supabase") {
    throw new InventoryStaffError("Solo disponible con DATA_MODE=supabase.", "data-mode");
  }
  const session = await resolveServerSession();
  if (session.kind === "anonymous" || !session.profile) {
    throw new InventoryStaffError("Debes iniciar sesión.", "unauthorized");
  }
  if (
    session.kind === "suspended_staff" ||
    session.profile.status === "suspended" ||
    session.profile.status === "inactive" ||
    session.profile.status === "invited"
  ) {
    throw new InventoryStaffError("Tu cuenta de personal no está activa.", "forbidden");
  }
  if (!isAdminRole(session.profile.role) || !adminRoleCan(session.profile.role, "manage-inventory")) {
    throw new InventoryStaffError("Tu rol no puede modificar inventario.", "forbidden");
  }
  return session;
}

function mapMovementDbError(error: unknown): InventoryStaffError {
  const db = (error ?? {}) as { message?: string; code?: string; details?: string };
  const raw = `${db.message ?? ""} ${db.details ?? ""}`.trim();
  if (/42501|no puede modificar este inventario|Se requiere una identidad/i.test(raw) || db.code === "42501") {
    return new InventoryStaffError("No tienes permiso para modificar este inventario.", "forbidden");
  }
  if (/inventario negativo|stock/i.test(raw)) {
    return new InventoryStaffError("El movimiento dejaría el stock en negativo.", "insufficient-stock");
  }
  if (/insumo no existe|inactivo|variacion no corresponde|motivo|idempotencia|Tipo de movimiento/i.test(raw)) {
    return new InventoryStaffError("Los datos del movimiento no son válidos.", "validation");
  }
  return new InventoryStaffError("No se pudo registrar el movimiento.", "persist");
}

/**
 * Recepción / ajuste / merma vía RPC `apply_inventory_movement`.
 * No hay UPDATE directo de stock desde Node.
 */
export async function applyStaffInventoryMovement(raw: unknown): Promise<void> {
  await requireInventoryManager();
  const parsed = movementSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InventoryStaffError(
      parsed.error.issues[0]?.message ?? "Datos de movimiento inválidos.",
      "validation",
    );
  }

  const client = await createServerSupabaseClient();
  const { data: itemRow, error: itemError } = await client
    .from("inventory_items")
    .select(
      "id, branch_id, name, slug, category, base_unit, display_unit, current_quantity, minimum_quantity, cost_per_base_unit, demo_image_key, is_active",
    )
    .eq("id", parsed.data.itemId)
    .maybeSingle();

  if (itemError) throw new InventoryStaffError("No se pudo leer el insumo.", "persist");
  if (!itemRow) throw new InventoryStaffError("No encontramos ese insumo.", "not-found");

  const item = mapInventoryItemRow(itemRow as InventoryItemRow);
  const unit = item.unit as InventoryUnit;
  let delta: number;
  let type: "purchase" | "adjustment" | "waste";

  if (parsed.data.action === "receive") {
    if (parsed.data.quantity <= 0) {
      throw new InventoryStaffError("La cantidad a ingresar debe ser mayor que cero.", "validation");
    }
    type = "purchase";
    delta = displayQuantityToBaseDelta(parsed.data.quantity, unit);
  } else if (parsed.data.action === "waste") {
    if (parsed.data.quantity <= 0) {
      throw new InventoryStaffError("La merma debe ser mayor que cero.", "validation");
    }
    type = "waste";
    delta = -displayQuantityToBaseDelta(parsed.data.quantity, unit);
  } else {
    if (parsed.data.quantity < 0) {
      throw new InventoryStaffError("La cantidad ajustada no puede ser negativa.", "validation");
    }
    type = "adjustment";
    const nextBase = displayQuantityToBaseDelta(parsed.data.quantity, unit);
    const currentBase = item.baseQuantity / QUANTITY_SCALE;
    delta = nextBase - currentBase;
    if (delta === 0) {
      throw new InventoryStaffError("El ajuste no cambia el stock.", "validation");
    }
  }

  try {
    const ops = createSupabaseOperations(client as never);
    await ops.applyInventoryMovement({
      itemId: item.id,
      type,
      delta,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } catch (error) {
    throw mapMovementDbError(error);
  }
}
