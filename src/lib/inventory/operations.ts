import { areUnitsCompatible, assertQuantity, fromBaseQuantity, getBaseUnit, toBaseQuantity } from "@/lib/inventory/units";
import type { InventoryItem, InventoryMovement, InventoryUnit, NewInventoryItem, Recipe } from "@/lib/inventory/types";

export interface InventoryOperationResult {
  items: InventoryItem[];
  movements: InventoryMovement[];
  nextId: number;
}

export type InventoryEditablePatch = Partial<Pick<InventoryItem, "name" | "category" | "unit" | "minimumQuantity" | "unitCost" | "active">>;

function assertReason(reason: string, label: string): string {
  const value = reason.trim();
  if (!value) throw new Error(`${label} requiere un motivo.`);
  return value;
}

function canonicalizeItem(item: InventoryItem): InventoryItem {
  const baseUnit = item.baseUnit ?? getBaseUnit(item.unit);
  const baseQuantity = item.baseQuantity ?? toBaseQuantity(item.quantity, item.unit);
  const minimumBaseQuantity = item.minimumBaseQuantity ?? toBaseQuantity(item.minimumQuantity, item.unit);
  const costPerBaseUnit = item.costPerBaseUnit ?? ((item.unitCost ?? 0) / (item.unit === "kg" || item.unit === "L" ? 1000 : 1));
  return {
    ...item,
    slug: item.slug ?? item.id,
    baseUnit,
    baseQuantity,
    minimumBaseQuantity,
    costPerBaseUnit,
  };
}

function movement(
  nextId: number,
  item: InventoryItem,
  type: InventoryMovement["type"],
  quantityDelta: number,
  balanceBefore: number,
  balanceAfter: number,
  reason: string,
  idempotencyKey = `local:${nextId}`,
): InventoryMovement {
  return {
    id: `mov-local-${nextId}`,
    itemId: item.id,
    type,
    quantity: Math.abs(quantityDelta),
    quantityDelta,
    baseQuantityDelta: toBaseQuantity(Math.abs(quantityDelta), item.unit) * Math.sign(quantityDelta),
    balanceBefore: toBaseQuantity(balanceBefore, item.unit),
    balanceAfter: toBaseQuantity(balanceAfter, item.unit),
    reason,
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };
}

export function addInventoryItem(items: InventoryItem[], movements: InventoryMovement[], input: NewInventoryItem, nextId: number): InventoryOperationResult {
  const name = input.name.trim();
  if (!name) throw new Error("Escribe el nombre del insumo.");
  if (!input.category.trim()) throw new Error("Selecciona una categoría.");
  assertQuantity(input.quantity, { allowZero: true, unit: input.unit });
  assertQuantity(input.minimumQuantity, { unit: input.unit });
  if (input.unitCost !== undefined && (!Number.isFinite(input.unitCost) || input.unitCost < 0)) throw new Error("El costo unitario no es válido.");
  const id = `inv-local-${nextId}`;
  const baseUnit = getBaseUnit(input.unit);
  const baseQuantity = toBaseQuantity(input.quantity, input.unit);
  const minimumBaseQuantity = toBaseQuantity(input.minimumQuantity, input.unit);
  const item: InventoryItem = {
    ...input,
    id,
    slug: input.slug ?? id,
    name,
    category: input.category.trim(),
    baseUnit,
    baseQuantity,
    minimumBaseQuantity,
    costPerBaseUnit: (input.unitCost ?? 0) / (input.unit === "kg" || input.unit === "L" ? 1000 : 1),
    imageKey: input.imageKey ?? "default",
  };
  const nextMovements = input.quantity > 0
    ? [...movements, movement(nextId, item, "initial_balance", input.quantity, 0, input.quantity, "Saldo inicial")]
    : movements;
  return { items: [...items.map(canonicalizeItem), item], movements: nextMovements, nextId: nextId + 1 };
}

export function updateInventoryItem(items: InventoryItem[], id: string, patch: InventoryEditablePatch, recipes?: Recipe[]): InventoryItem[] {
  return items.map((original) => {
    const item = canonicalizeItem(original);
    if (item.id !== id) return item;
    if (patch.active === false && item.active) assertNoActiveRecipeReference(recipes, id);
    const nextUnit = patch.unit ?? item.unit;
    if (!areUnitsCompatible(item.unit, nextUnit)) throw new Error("No puedes cambiar masa, volumen y unidades contables entre sí.");
    const next = {
      ...item,
      name: patch.name?.trim() ?? item.name,
      category: patch.category?.trim() ?? item.category,
      unit: nextUnit,
      active: patch.active ?? item.active,
    };
    if (!next.name || !next.category) throw new Error("Nombre y categoría son obligatorios.");
    const nextMinimumQuantity = patch.minimumQuantity === undefined ? fromBaseQuantity(item.minimumBaseQuantity, nextUnit) : next.minimumQuantity;
    assertQuantity(nextMinimumQuantity, { unit: nextUnit });
    const factor = nextUnit === "kg" || nextUnit === "L" ? 1000 : 1;
    const nextUnitCost = patch.unitCost === undefined ? (item.costPerBaseUnit ?? 0) * factor : next.unitCost;
    if (nextUnitCost !== undefined && (!Number.isFinite(nextUnitCost) || nextUnitCost < 0)) throw new Error("El costo unitario no es válido.");
    const baseUnit = getBaseUnit(nextUnit);
    return { ...next, unitCost: nextUnitCost, minimumQuantity: nextMinimumQuantity, baseUnit, quantity: fromBaseQuantity(item.baseQuantity, nextUnit), minimumBaseQuantity: toBaseQuantity(nextMinimumQuantity, nextUnit), baseQuantity: item.baseQuantity, costPerBaseUnit: (nextUnitCost ?? 0) / factor };
  });
}

export function receiveInventoryQuantity(items: InventoryItem[], movements: InventoryMovement[], id: string, quantity: number, reason: string, nextId: number): InventoryOperationResult {
  const item = canonicalizeItem(items.find((candidate) => candidate.id === id) ?? (() => { throw new Error("No se encontró el insumo."); })());
  if (!item.active) throw new Error("Activa el insumo antes de ingresar cantidad.");
  assertQuantity(quantity, { unit: item.unit });
  const nextBaseQuantity = item.baseQuantity + toBaseQuantity(quantity, item.unit);
  const nextItem = { ...item, baseQuantity: nextBaseQuantity, quantity: fromBaseQuantity(nextBaseQuantity, item.unit) };
  return {
    items: items.map((candidate) => candidate.id === id ? nextItem : canonicalizeItem(candidate)),
    movements: [...movements, movement(nextId, item, "purchase", quantity, item.quantity, nextItem.quantity, reason.trim() || "Entrada por compra")],
    nextId: nextId + 1,
  };
}

export function adjustInventoryQuantity(items: InventoryItem[], movements: InventoryMovement[], id: string, nextQuantity: number, reason: string, nextId: number): InventoryOperationResult {
  const item = canonicalizeItem(items.find((candidate) => candidate.id === id) ?? (() => { throw new Error("No se encontró el insumo."); })());
  if (!item.active) throw new Error("No puedes ajustar un insumo inactivo.");
  assertQuantity(nextQuantity, { allowZero: true, unit: item.unit });
  const cleanReason = assertReason(reason, "El ajuste");
  const nextBaseQuantity = toBaseQuantity(nextQuantity, item.unit);
  const delta = nextBaseQuantity - item.baseQuantity;
  const nextItem = { ...item, baseQuantity: nextBaseQuantity, quantity: nextQuantity };
  return {
    items: items.map((candidate) => candidate.id === id ? nextItem : canonicalizeItem(candidate)),
    movements: delta === 0 ? movements : [...movements, movement(nextId, item, "adjustment", nextQuantity - item.quantity, item.quantity, nextQuantity, cleanReason)],
    nextId: delta === 0 ? nextId : nextId + 1,
  };
}

export function recordInventoryWaste(items: InventoryItem[], movements: InventoryMovement[], id: string, quantity: number, reason: string, nextId: number): InventoryOperationResult {
  const item = canonicalizeItem(items.find((candidate) => candidate.id === id) ?? (() => { throw new Error("No se encontró el insumo."); })());
  if (!item.active) throw new Error("No puedes registrar merma de un insumo inactivo.");
  assertQuantity(quantity, { unit: item.unit });
  const cleanReason = assertReason(reason, "La merma");
  const delta = toBaseQuantity(quantity, item.unit);
  if (delta > item.baseQuantity) throw new Error("La merma no puede superar el stock actual.");
  const nextBaseQuantity = item.baseQuantity - delta;
  const nextItem = { ...item, baseQuantity: nextBaseQuantity, quantity: fromBaseQuantity(nextBaseQuantity, item.unit) };
  return {
    items: items.map((candidate) => candidate.id === id ? nextItem : canonicalizeItem(candidate)),
    movements: [...movements, movement(nextId, item, "waste", -quantity, item.quantity, nextItem.quantity, cleanReason)],
    nextId: nextId + 1,
  };
}

function assertNoActiveRecipeReference(recipes: Recipe[] | undefined, id: string): void {
  if (recipes?.some((recipe) => recipe.isActive && recipe.items.some((ingredient) => ingredient.inventoryItemId === id))) {
    throw new Error("Este insumo pertenece a una receta activa; desactiva la receta antes de retirarlo.");
  }
}

export function deactivateInventoryItem(items: InventoryItem[], id: string, recipes?: Recipe[]): InventoryItem[] {
  assertNoActiveRecipeReference(recipes, id);
  if (!items.some((item) => item.id === id)) throw new Error("No se encontró el insumo.");
  return items.map((item) => item.id === id ? { ...canonicalizeItem(item), active: false } : canonicalizeItem(item));
}

export function deleteInventoryItem(items: InventoryItem[], movements: InventoryMovement[], id: string, recipes?: Recipe[]): InventoryItem[] {
  if (movements.some((movementItem) => movementItem.itemId === id)) throw new Error("Este insumo tiene historia demo; puedes desactivarlo, pero no borrarlo.");
  assertNoActiveRecipeReference(recipes, id);
  return items.filter((item) => item.id !== id).map(canonicalizeItem);
}

export function isInventoryUnit(value: string): value is InventoryUnit {
  return ["kg", "g", "L", "ml", "unidad"].includes(value as InventoryUnit);
}

export function canonicalizeMovement(movementItem: InventoryMovement, items: InventoryItem[]): InventoryMovement {
  const item = items.find((candidate) => candidate.id === movementItem.itemId);
  if (!item) return movementItem;
  const canonicalItem = canonicalizeItem(item);
  const isCanonical = typeof movementItem.baseQuantityDelta === "number";
  const quantityDelta = movementItem.quantityDelta ?? (movementItem.type === "consumption" || movementItem.type === "waste" ? -movementItem.quantity : movementItem.quantity);
  const baseQuantityDelta = movementItem.baseQuantityDelta ?? toBaseQuantity(Math.abs(quantityDelta), canonicalItem.unit) * Math.sign(quantityDelta);
  return {
    ...movementItem,
    quantityDelta,
    baseQuantityDelta,
    balanceBefore: isCanonical
      ? movementItem.balanceBefore
      : toBaseQuantity(movementItem.balanceBefore ?? fromBaseQuantity(canonicalItem.baseQuantity, canonicalItem.unit), canonicalItem.unit),
    balanceAfter: isCanonical
      ? movementItem.balanceAfter
      : toBaseQuantity(movementItem.balanceAfter ?? fromBaseQuantity(canonicalItem.baseQuantity, canonicalItem.unit), canonicalItem.unit),
    idempotencyKey: movementItem.idempotencyKey ?? `legacy:${movementItem.id}`,
  };
}

export { canonicalizeItem };
