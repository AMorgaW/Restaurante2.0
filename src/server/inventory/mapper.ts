import { fromBaseQuantity, QUANTITY_SCALE, toBaseQuantity } from "@/lib/inventory/units";
import type {
  InventoryBaseUnit,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryUnit,
} from "@/lib/inventory/types";

const DISPLAY_UNITS = new Set<InventoryUnit>(["kg", "g", "L", "ml", "unidad"]);
const BASE_UNITS = new Set<InventoryBaseUnit>(["g", "ml", "unidad"]);
const MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "initial_balance",
  "purchase",
  "consumption",
  "adjustment",
  "waste",
  "reversal",
]);

export type InventoryItemRow = {
  id: string;
  branch_id: string;
  name: string;
  slug: string;
  category: string;
  base_unit: string;
  display_unit: string;
  current_quantity: number | string;
  minimum_quantity: number | string;
  cost_per_base_unit: number | string;
  demo_image_key: string | null;
  is_active: boolean;
};

export type InventoryMovementRow = {
  id: string;
  inventory_item_id: string;
  movement_type: string;
  quantity_delta: number | string;
  balance_before: number | string;
  balance_after: number | string;
  reason: string;
  created_at: string;
  idempotency_key: string;
  order_id: string | null;
  order_item_id: string | null;
  actor_profile_id: string | null;
  reversal_of_movement_id: string | null;
};

function asNumber(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("Cantidad de inventario inválida.");
  return n;
}

function asDisplayUnit(value: string): InventoryUnit {
  if (!DISPLAY_UNITS.has(value as InventoryUnit)) throw new Error("Unidad de presentación inválida.");
  return value as InventoryUnit;
}

function asBaseUnit(value: string): InventoryBaseUnit {
  if (!BASE_UNITS.has(value as InventoryBaseUnit)) throw new Error("Unidad base inválida.");
  return value as InventoryBaseUnit;
}

/** PostgreSQL guarda cantidades en unidad canónica (g/ml/unidad). El dominio demo usa milésimas. */
export function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  const displayUnit = asDisplayUnit(row.display_unit);
  const baseUnit = asBaseUnit(row.base_unit);
  const baseQuantity = Math.round(asNumber(row.current_quantity) * QUANTITY_SCALE);
  const minimumBaseQuantity = Math.round(asNumber(row.minimum_quantity) * QUANTITY_SCALE);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    unit: displayUnit,
    baseUnit,
    quantity: fromBaseQuantity(baseQuantity, displayUnit),
    minimumQuantity: fromBaseQuantity(minimumBaseQuantity, displayUnit),
    baseQuantity,
    minimumBaseQuantity,
    costPerBaseUnit: asNumber(row.cost_per_base_unit),
    branchId: row.branch_id,
    active: row.is_active,
    imageKey: row.demo_image_key ?? "default",
  };
}

export function mapInventoryMovementRow(row: InventoryMovementRow, displayUnit: InventoryUnit): InventoryMovement {
  const type = MOVEMENT_TYPES.has(row.movement_type as InventoryMovementType)
    ? (row.movement_type as InventoryMovementType)
    : "adjustment";
  const deltaBase = Math.round(asNumber(row.quantity_delta) * QUANTITY_SCALE);
  const beforeBase = Math.round(asNumber(row.balance_before) * QUANTITY_SCALE);
  const afterBase = Math.round(asNumber(row.balance_after) * QUANTITY_SCALE);
  const signedDisplayDelta =
    Math.sign(deltaBase) * fromBaseQuantity(Math.abs(deltaBase), displayUnit);
  return {
    id: row.id,
    itemId: row.inventory_item_id,
    type,
    quantity: Math.abs(signedDisplayDelta),
    quantityDelta: signedDisplayDelta,
    baseQuantityDelta: deltaBase,
    balanceBefore: fromBaseQuantity(beforeBase, displayUnit),
    balanceAfter: fromBaseQuantity(afterBase, displayUnit),
    reason: row.reason,
    createdAt: row.created_at,
    idempotencyKey: row.idempotency_key,
    orderId: row.order_id ?? undefined,
    orderItemId: row.order_item_id ?? undefined,
    actorProfileId: row.actor_profile_id ?? undefined,
    reversalOfMovementId: row.reversal_of_movement_id ?? undefined,
  };
}

/** Convierte cantidad de UI (unidad de presentación) a delta canónico para RPC. */
export function displayQuantityToBaseDelta(quantity: number, unit: InventoryUnit): number {
  return toBaseQuantity(quantity, unit) / QUANTITY_SCALE;
}
