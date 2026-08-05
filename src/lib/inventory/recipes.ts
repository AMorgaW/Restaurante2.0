import { toBaseQuantity } from "@/lib/inventory/units";
import type { InventoryBaseUnit, InventoryItem, Recipe, RecipeItem } from "@/lib/inventory/types";
import { areUnitsCompatible } from "@/lib/inventory/units";
import { DEMO_INVENTORY_ITEMS } from "@/lib/inventory/fixtures";

export class InventoryRecipeError extends Error {
  constructor(message: string, public readonly code: "invalid_recipe" | "duplicate_ingredient" | "incompatible_unit" | "inactive_ingredient" | "recipe_missing") {
    super(message);
    this.name = "InventoryRecipeError";
  }
}

export interface RecipeInput {
  id?: string;
  productId: string;
  branchId?: string;
  portionYield: number;
  isActive: boolean;
  items: Array<{ inventoryItemId: string; quantityRequired: number; baseUnit: InventoryBaseUnit }>;
  demoOnly?: boolean;
}

export function validateRecipeInput(input: RecipeInput, inventoryItems: InventoryItem[]): void {
  if (!input.productId.trim() || !Number.isFinite(input.portionYield) || input.portionYield <= 0) {
    throw new InventoryRecipeError("La receta requiere un producto y un rendimiento mayor que cero.", "invalid_recipe");
  }
  if (input.isActive && input.items.length === 0) {
    throw new InventoryRecipeError("Una receta activa debe tener al menos un ingrediente.", "invalid_recipe");
  }
  const seen = new Set<string>();
  for (const ingredient of input.items) {
    if (seen.has(ingredient.inventoryItemId)) {
      throw new InventoryRecipeError("No se puede repetir un ingrediente en la misma receta.", "duplicate_ingredient");
    }
    seen.add(ingredient.inventoryItemId);
    if (!Number.isFinite(ingredient.quantityRequired) || ingredient.quantityRequired <= 0) {
      throw new InventoryRecipeError("Cada ingrediente debe tener una cantidad mayor que cero.", "invalid_recipe");
    }
    const inventoryItem = inventoryItems.find((item) => item.id === ingredient.inventoryItemId);
    if (!inventoryItem) throw new InventoryRecipeError("El ingrediente no existe.", "invalid_recipe");
    if (!inventoryItem.active) throw new InventoryRecipeError(`El ingrediente ${inventoryItem.name} está inactivo.`, "inactive_ingredient");
    if (!areUnitsCompatible(inventoryItem.baseUnit, ingredient.baseUnit)) {
      throw new InventoryRecipeError(`La unidad de ${inventoryItem.name} no es compatible con la receta.`, "incompatible_unit");
    }
  }
}

export function createRecipe(input: RecipeInput, inventoryItems: InventoryItem[], now = new Date("2026-08-04T12:00:00-05:00")): Recipe {
  validateRecipeInput(input, inventoryItems);
  const createdAt = now.toISOString();
  const id = input.id ?? `recipe-local-${input.productId}`;
  const items: RecipeItem[] = input.items.map((ingredient, index) => ({
    id: `${id}-ingredient-${index + 1}`,
    recipeId: id,
    inventoryItemId: ingredient.inventoryItemId,
    quantityRequired: ingredient.quantityRequired,
    quantityRequiredBase: toBaseQuantity(ingredient.quantityRequired, ingredient.baseUnit),
    baseUnit: ingredient.baseUnit,
    createdAt,
  }));
  return { id, productId: input.productId, ...(input.branchId ? { branchId: input.branchId } : {}), portionYield: input.portionYield, isActive: input.isActive, items, createdAt, updatedAt: createdAt, ...(input.demoOnly ? { demoOnly: true } : {}) };
}

export function findActiveRecipe(recipes: Recipe[], productId: string, branchId?: string): Recipe | null {
  return recipes
    .filter((recipe) => recipe.productId === productId && recipe.isActive && (!recipe.branchId || recipe.branchId === branchId))
    .sort((left, right) => Number(Boolean(right.branchId)) - Number(Boolean(left.branchId)))[0] ?? null;
}

export function hasActiveRecipe(recipes: Recipe[], productId: string, branchId?: string): boolean {
  return findActiveRecipe(recipes, productId, branchId) !== null;
}

export function updateRecipe(recipe: Recipe, input: RecipeInput, inventoryItems: InventoryItem[], now = new Date()): Recipe {
  const next = createRecipe({ ...input, id: recipe.id }, inventoryItems, now);
  return { ...next, createdAt: recipe.createdAt };
}

/** Cantidades ficticias para demostrar el contrato; no son recetas comerciales. */
const demoIngredient = (inventoryItemId: string, quantityRequired: number): { inventoryItemId: string; quantityRequired: number; baseUnit: InventoryBaseUnit } => ({
  inventoryItemId,
  quantityRequired,
  baseUnit: DEMO_INVENTORY_ITEMS.find((item) => item.id === inventoryItemId)!.baseUnit,
});

export const DEMO_RECIPES: Recipe[] = [
  createRecipe({
    productId: "carne-asada-falda-de-res-con-ensalada-arroz-frijoles-y-jalapenos",
    portionYield: 1,
    isActive: true,
    demoOnly: true,
    items: [demoIngredient("inv-carne-res", 180), demoIngredient("inv-arroz", 120), demoIngredient("inv-verduras", 80)],
  }, DEMO_INVENTORY_ITEMS),
  createRecipe({
    productId: "carne-asada-plato-con-cebolleta",
    portionYield: 1,
    isActive: true,
    demoOnly: true,
    items: [demoIngredient("inv-carne-res", 160), demoIngredient("inv-papa", 140), demoIngredient("inv-verduras", 60)],
  }, DEMO_INVENTORY_ITEMS),
  createRecipe({
    productId: "arroz-amarillo-carne-asada-frijoles",
    portionYield: 1,
    isActive: true,
    demoOnly: true,
    items: [demoIngredient("inv-carne-res", 150), demoIngredient("inv-arroz", 150), demoIngredient("inv-tomates", 1)],
  }, DEMO_INVENTORY_ITEMS),
];
