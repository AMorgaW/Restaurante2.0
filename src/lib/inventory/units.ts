import type { InventoryBaseUnit, InventoryUnit } from "@/lib/inventory/types";

/**
 * Las cantidades de dominio se almacenan como enteros en milésimas de la
 * unidad base: gramos, mililitros o unidades. Esto evita comparar floats en
 * operaciones de stock y deja la conversión de presentación en un solo sitio.
 */
export const QUANTITY_SCALE = 1000;

type UnitDimension = "mass" | "volume" | "count";

const UNIT_DEFINITIONS: Record<InventoryUnit, { baseUnit: InventoryBaseUnit; dimension: UnitDimension; factor: number }> = {
  kg: { baseUnit: "g", dimension: "mass", factor: 1000 },
  g: { baseUnit: "g", dimension: "mass", factor: 1 },
  L: { baseUnit: "ml", dimension: "volume", factor: 1000 },
  ml: { baseUnit: "ml", dimension: "volume", factor: 1 },
  unidad: { baseUnit: "unidad", dimension: "count", factor: 1 },
};

export function getUnitDefinition(unit: InventoryUnit) {
  return UNIT_DEFINITIONS[unit];
}

export function getBaseUnit(unit: InventoryUnit): InventoryBaseUnit {
  return UNIT_DEFINITIONS[unit].baseUnit;
}

export function areUnitsCompatible(left: InventoryUnit | InventoryBaseUnit, right: InventoryUnit | InventoryBaseUnit): boolean {
  const leftDefinition = left in UNIT_DEFINITIONS
    ? UNIT_DEFINITIONS[left as InventoryUnit]
    : { baseUnit: left as InventoryBaseUnit, dimension: left === "g" ? "mass" : left === "ml" ? "volume" : "count" };
  const rightDefinition = right in UNIT_DEFINITIONS
    ? UNIT_DEFINITIONS[right as InventoryUnit]
    : { baseUnit: right as InventoryBaseUnit, dimension: right === "g" ? "mass" : right === "ml" ? "volume" : "count" };
  return leftDefinition.dimension === rightDefinition.dimension;
}

export function assertQuantity(value: number, options: { allowZero?: boolean; unit?: InventoryUnit } = {}): void {
  const minimum = options.allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(options.allowZero ? "La cantidad no puede ser negativa." : "La cantidad debe ser mayor que cero.");
  }
  if (options.unit === "unidad" && !Number.isInteger(value)) {
    throw new Error("Los artículos contables deben usar unidades enteras.");
  }
}

export function toBaseQuantity(value: number, unit: InventoryUnit | InventoryBaseUnit): number {
  const displayUnit = unit in UNIT_DEFINITIONS ? (unit as InventoryUnit) : (unit as InventoryBaseUnit);
  const definition = unit in UNIT_DEFINITIONS
    ? UNIT_DEFINITIONS[unit as InventoryUnit]
    : { baseUnit: unit as InventoryBaseUnit, dimension: unit === "g" ? "mass" : unit === "ml" ? "volume" : "count", factor: 1 };
  assertQuantity(value, { allowZero: true, unit: displayUnit in UNIT_DEFINITIONS ? displayUnit as InventoryUnit : undefined });
  const scaled = Math.round(value * definition.factor * QUANTITY_SCALE);
  if (!Number.isSafeInteger(scaled)) throw new Error("La cantidad supera la precisión permitida.");
  return scaled;
}

export function fromBaseQuantity(value: number, unit: InventoryUnit | InventoryBaseUnit): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("La cantidad base no es válida.");
  const definition = unit in UNIT_DEFINITIONS
    ? UNIT_DEFINITIONS[unit as InventoryUnit]
    : { baseUnit: unit as InventoryBaseUnit, dimension: unit === "g" ? "mass" : unit === "ml" ? "volume" : "count", factor: 1 };
  return roundQuantity(value / (definition.factor * QUANTITY_SCALE));
}

export function convertQuantity(value: number, from: InventoryUnit, to: InventoryUnit): number {
  if (!areUnitsCompatible(from, to)) throw new Error(`No se puede convertir ${from} a ${to}.`);
  return fromBaseQuantity(toBaseQuantity(value, from), to);
}

export function roundQuantity(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatQuantity(value: number, unit: InventoryUnit): string {
  const normalized = roundQuantity(value);
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(normalized)} ${unit}`;
}
