import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  mapInventoryItemRow,
  mapInventoryMovementRow,
  type InventoryItemRow,
  type InventoryMovementRow,
} from "@/server/inventory/mapper";
import type { InventoryItem, InventoryMovement } from "@/lib/inventory/types";

export class InventoryReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryReadError";
  }
}

export type LoadedInventory = {
  items: InventoryItem[];
  movements: InventoryMovement[];
};

/**
 * Lee inventario visible vía RLS (sin fallback a fixtures).
 * Movements solo llegan a owner/admin/manager según can_read_inventory_movements.
 */
export async function loadOperationalInventory(): Promise<LoadedInventory> {
  const client = await createServerSupabaseClient();
  const [{ data: itemRows, error: itemsError }, { data: movementRows, error: movementsError }] =
    await Promise.all([
      client
        .from("inventory_items")
        .select(
          "id, branch_id, name, slug, category, base_unit, display_unit, current_quantity, minimum_quantity, cost_per_base_unit, demo_image_key, is_active",
        )
        .order("name", { ascending: true }),
      client
        .from("inventory_movements")
        .select(
          "id, inventory_item_id, movement_type, quantity_delta, balance_before, balance_after, reason, created_at, idempotency_key, order_id, order_item_id, actor_profile_id, reversal_of_movement_id",
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (itemsError) throw new InventoryReadError("No se pudieron leer los insumos.");
  if (movementsError) throw new InventoryReadError("No se pudieron leer los movimientos de inventario.");

  const items = ((itemRows ?? []) as InventoryItemRow[]).map(mapInventoryItemRow);
  const unitByItem = new Map(items.map((item) => [item.id, item.unit]));
  const movements = ((movementRows ?? []) as InventoryMovementRow[])
    .map((row) => {
      const unit = unitByItem.get(row.inventory_item_id);
      if (!unit) return null;
      return mapInventoryMovementRow(row, unit);
    })
    .filter((row): row is InventoryMovement => row !== null);

  return { items, movements };
}

export async function loadOperationalInventoryForUi(): Promise<
  | { mode: "supabase"; items: InventoryItem[]; movements: InventoryMovement[]; error: null }
  | { mode: "supabase"; items: []; movements: []; error: string }
> {
  try {
    const loaded = await loadOperationalInventory();
    return { mode: "supabase", items: loaded.items, movements: loaded.movements, error: null };
  } catch {
    return {
      mode: "supabase",
      items: [],
      movements: [],
      error: "No se pudo cargar el inventario real. Intenta de nuevo.",
    };
  }
}
