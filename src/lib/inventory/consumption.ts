import { findActiveRecipe } from "@/lib/inventory/recipes";
import { fromBaseQuantity } from "@/lib/inventory/units";
import type { InventoryConsumptionRequirement, InventoryItem, InventoryMovement, Recipe } from "@/lib/inventory/types";
import type { Order, OrderStatus } from "@/types/order";

export type InventoryDomainErrorCode = "invalid_transition" | "recipe_missing" | "insufficient_stock" | "item_missing" | "already_reversed" | "reversal_forbidden" | "movement_missing";

export class InventoryDomainError extends Error {
  constructor(message: string, public readonly code: InventoryDomainErrorCode, public readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "InventoryDomainError";
  }
}

export interface InventoryConsumptionResult {
  items: InventoryItem[];
  movements: InventoryMovement[];
  consumed: boolean;
  replayed: boolean;
  requirements: InventoryConsumptionRequirement[];
}

function getConsumptionRequirements(items: InventoryItem[], recipes: Recipe[], order: Order, branchId?: string): InventoryConsumptionRequirement[] {
  const grouped = new Map<string, number>();
  const missingProducts: string[] = [];
  for (const orderItem of order.items) {
    const recipe = findActiveRecipe(recipes, orderItem.itemId, branchId ?? order.branchId);
    if (!recipe) {
      missingProducts.push(orderItem.itemId);
      continue;
    }
    for (const ingredient of recipe.items) {
      const required = (ingredient.quantityRequiredBase * orderItem.quantity) / recipe.portionYield;
      grouped.set(ingredient.inventoryItemId, (grouped.get(ingredient.inventoryItemId) ?? 0) + required);
    }
  }
  if (missingProducts.length > 0) {
    throw new InventoryDomainError("El pedido tiene productos sin receta activa; no se puede consumir inventario.", "recipe_missing", { productIds: missingProducts });
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([inventoryItemId, rawRequiredBaseQuantity]) => {
    const requiredBaseQuantity = Math.max(1, Math.round(rawRequiredBaseQuantity));
    const inventoryItem = items.find((candidate) => candidate.id === inventoryItemId);
    if (!inventoryItem) throw new InventoryDomainError("La receta referencia un insumo inexistente.", "item_missing", { inventoryItemId });
    return {
      inventoryItemId,
      requiredBaseQuantity,
      requiredQuantity: fromBaseQuantity(requiredBaseQuantity, inventoryItem.unit),
      unit: inventoryItem.unit,
      availableBaseQuantity: inventoryItem.baseQuantity,
    };
  });
}

export function calculateExpectedConsumption(items: InventoryItem[], recipes: Recipe[], order: Order, branchId?: string): InventoryConsumptionRequirement[] {
  const requirements = getConsumptionRequirements(items, recipes, order, branchId);
  const insufficient = requirements.filter((requirement) => requirement.requiredBaseQuantity > requirement.availableBaseQuantity);
  if (insufficient.length > 0) {
    throw new InventoryDomainError("El stock es insuficiente para entregar el pedido.", "insufficient_stock", {
      items: insufficient.map((requirement) => ({ inventoryItemId: requirement.inventoryItemId, required: requirement.requiredBaseQuantity, available: requirement.availableBaseQuantity })),
    });
  }
  return requirements;
}

export function consumeOrderForDelivery(
  items: InventoryItem[],
  movements: InventoryMovement[],
  order: Order,
  recipes: Recipe[],
  previousStatus: OrderStatus,
  actorProfileId = "demo-admin",
  now = new Date(),
): InventoryConsumptionResult {
  if (previousStatus !== "ready" || order.status !== "delivered") {
    throw new InventoryDomainError("El consumo solo ocurre en la transición válida de listo a entregado.", "invalid_transition");
  }
  const existing = movements.filter((movement) => movement.type === "consumption" && movement.orderId === order.id);
  if (existing.length > 0) {
    return { items, movements, consumed: false, replayed: true, requirements: [] };
  }
  const requirements = calculateExpectedConsumption(items, recipes, order, order.branchId);
  const timestamp = now.toISOString();
  const nextItems = items.map((item) => {
    const requirement = requirements.find((candidate) => candidate.inventoryItemId === item.id);
    if (!requirement) return item;
    const nextBaseQuantity = item.baseQuantity - requirement.requiredBaseQuantity;
    return { ...item, baseQuantity: nextBaseQuantity, quantity: fromBaseQuantity(nextBaseQuantity, item.unit) };
  });
  const nextMovements = [
    ...movements,
    ...requirements.map((requirement, index) => {
      const item = items.find((candidate) => candidate.id === requirement.inventoryItemId)!;
      const balanceAfter = item.baseQuantity - requirement.requiredBaseQuantity;
      return {
        id: `mov-consumption-${order.id}-${index + 1}`,
        itemId: item.id,
        type: "consumption" as const,
        quantity: fromBaseQuantity(requirement.requiredBaseQuantity, item.unit),
        quantityDelta: -fromBaseQuantity(requirement.requiredBaseQuantity, item.unit),
        baseQuantityDelta: -requirement.requiredBaseQuantity,
        balanceBefore: item.baseQuantity,
        balanceAfter,
        reason: `Salida por pedido ${order.orderNumber}`,
        createdAt: timestamp,
        idempotencyKey: `order:${order.id}:consumption:${item.id}`,
        orderId: order.id,
        actorProfileId,
        metadata: { source: "delivered_transition" },
      } satisfies InventoryMovement;
    }),
  ];
  return { items: nextItems, movements: nextMovements, consumed: true, replayed: false, requirements };
}

export function reverseInventoryConsumption(
  items: InventoryItem[],
  movements: InventoryMovement[],
  movementId: string,
  actorRole: string,
  reason: string,
  actorProfileId = "demo-admin",
  now = new Date(),
): { items: InventoryItem[]; movements: InventoryMovement[] } {
  if (actorRole !== "owner" && actorRole !== "admin") throw new InventoryDomainError("Solo owner o admin puede revertir un consumo.", "reversal_forbidden");
  if (!reason.trim()) throw new InventoryDomainError("La reversión requiere un motivo.", "reversal_forbidden");
  const original = movements.find((movement) => movement.id === movementId);
  if (!original || original.type !== "consumption") throw new InventoryDomainError("No se encontró el movimiento de consumo.", "movement_missing");
  if (movements.some((movement) => movement.type === "reversal" && movement.reversalOfMovementId === movementId)) {
    throw new InventoryDomainError("Este consumo ya fue revertido.", "already_reversed");
  }
  const item = items.find((candidate) => candidate.id === original.itemId);
  if (!item) throw new InventoryDomainError("El insumo del movimiento ya no existe.", "item_missing");
  const balanceAfter = item.baseQuantity - original.baseQuantityDelta;
  const reversal: InventoryMovement = {
    id: `mov-reversal-${movementId}`,
    itemId: item.id,
    type: "reversal",
    quantity: fromBaseQuantity(-original.baseQuantityDelta, item.unit),
    quantityDelta: fromBaseQuantity(-original.baseQuantityDelta, item.unit),
    baseQuantityDelta: -original.baseQuantityDelta,
    balanceBefore: item.baseQuantity,
    balanceAfter,
    reason: reason.trim(),
    createdAt: now.toISOString(),
    idempotencyKey: `reversal:${movementId}`,
    orderId: original.orderId,
    actorProfileId,
    reversalOfMovementId: movementId,
    metadata: { source: "admin_reversal" },
  };
  return {
    items: items.map((candidate) => candidate.id === item.id ? { ...candidate, baseQuantity: balanceAfter, quantity: fromBaseQuantity(balanceAfter, item.unit) } : candidate),
    movements: [...movements, reversal],
  };
}
