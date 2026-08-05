export const INVENTORY_UNITS = ["kg", "g", "L", "ml", "unidad"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
export const INVENTORY_BASE_UNITS = ["g", "ml", "unidad"] as const;
export type InventoryBaseUnit = (typeof INVENTORY_BASE_UNITS)[number];

export const INVENTORY_STATUS_VALUES = ["available", "low", "critical", "out", "inactive"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUS_VALUES)[number];

export type InventoryMovementType = "initial_balance" | "purchase" | "consumption" | "adjustment" | "waste" | "reversal";

export interface InventoryItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  unit: InventoryUnit;
  baseUnit: InventoryBaseUnit;
  quantity: number;
  minimumQuantity: number;
  baseQuantity: number;
  minimumBaseQuantity: number;
  unitCost?: number;
  costPerBaseUnit?: number;
  branchId?: string;
  active: boolean;
  imageKey: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  quantityDelta: number;
  baseQuantityDelta: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
  idempotencyKey: string;
  orderId?: string;
  orderItemId?: string;
  actorProfileId?: string;
  reversalOfMovementId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface NewInventoryItem {
  name: string;
  slug?: string;
  category: string;
  unit: InventoryUnit;
  quantity: number;
  minimumQuantity: number;
  unitCost?: number;
  branchId?: string;
  active: boolean;
  imageKey?: string;
}

export interface InventoryFilters {
  search: string;
  category: string;
  status: InventoryStatus | "all";
  activity: "all" | "active" | "inactive";
}

export interface InventorySummary {
  active: number;
  low: number;
  critical: number;
  out: number;
  estimatedValue: number;
  consumptionToday: number;
  recentMovements: InventoryMovement[];
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityRequired: number;
  quantityRequiredBase: number;
  baseUnit: InventoryBaseUnit;
  createdAt: string;
}

export interface Recipe {
  id: string;
  productId: string;
  branchId?: string;
  portionYield: number;
  isActive: boolean;
  items: RecipeItem[];
  createdAt: string;
  updatedAt: string;
  demoOnly?: boolean;
}

export interface InventoryConsumptionRequirement {
  inventoryItemId: string;
  requiredBaseQuantity: number;
  requiredQuantity: number;
  unit: InventoryUnit;
  availableBaseQuantity: number;
}
