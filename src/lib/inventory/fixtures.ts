import { getBaseUnit, toBaseQuantity } from "@/lib/inventory/units";
import type { InventoryItem, InventoryMovement, InventoryUnit } from "@/lib/inventory/types";

/** Fixtures locales deterministas; no representan persistencia remota. */
export const INVENTORY_CATEGORIES = ["Carnes", "Granos", "Tubérculos", "Verduras", "Despensa", "Lácteos"] as const;

function demoItem(input: {
  id: string;
  name: string;
  category: string;
  unit: InventoryUnit;
  quantity: number;
  minimumQuantity: number;
  unitCost: number;
  active: boolean;
  imageKey: string;
}): InventoryItem {
  return {
    ...input,
    slug: input.id,
    baseUnit: getBaseUnit(input.unit),
    baseQuantity: toBaseQuantity(input.quantity, input.unit),
    minimumBaseQuantity: toBaseQuantity(input.minimumQuantity, input.unit),
    costPerBaseUnit: input.unitCost / (input.unit === "kg" || input.unit === "L" ? 1000 : 1),
  };
}

export const DEMO_INVENTORY_ITEMS: InventoryItem[] = [
  demoItem({ id: "inv-carne-res", name: "Carne de res", category: "Carnes", unit: "kg", quantity: 18.5, minimumQuantity: 10, unitCost: 28000, active: true, imageKey: "carne" }),
  demoItem({ id: "inv-cerdo", name: "Cerdo", category: "Carnes", unit: "kg", quantity: 3.2, minimumQuantity: 5, unitCost: 23000, active: true, imageKey: "cerdo" }),
  demoItem({ id: "inv-costilla", name: "Costilla", category: "Carnes", unit: "kg", quantity: 0.8, minimumQuantity: 3, unitCost: 26000, active: true, imageKey: "costilla" }),
  demoItem({ id: "inv-arroz", name: "Arroz", category: "Granos", unit: "kg", quantity: 25, minimumQuantity: 10, unitCost: 4500, active: true, imageKey: "arroz" }),
  demoItem({ id: "inv-papa", name: "Papa", category: "Tubérculos", unit: "kg", quantity: 6, minimumQuantity: 5, unitCost: 3500, active: true, imageKey: "papa" }),
  demoItem({ id: "inv-yuca", name: "Yuca", category: "Tubérculos", unit: "kg", quantity: 3.5, minimumQuantity: 4, unitCost: 2800, active: true, imageKey: "yuca" }),
  demoItem({ id: "inv-verduras", name: "Verduras", category: "Verduras", unit: "kg", quantity: 9, minimumQuantity: 5, unitCost: 5000, active: true, imageKey: "verduras" }),
  demoItem({ id: "inv-aceite", name: "Aceite", category: "Despensa", unit: "L", quantity: 4, minimumQuantity: 2, unitCost: 12000, active: true, imageKey: "aceite" }),
  demoItem({ id: "inv-leche", name: "Leche", category: "Lácteos", unit: "ml", quantity: 0, minimumQuantity: 2000, unitCost: 4, active: true, imageKey: "leche" }),
  demoItem({ id: "inv-tomates", name: "Tomates", category: "Verduras", unit: "unidad", quantity: 14, minimumQuantity: 8, unitCost: 700, active: true, imageKey: "verduras" }),
  demoItem({ id: "inv-sal", name: "Sal de cocina", category: "Despensa", unit: "g", quantity: 0, minimumQuantity: 500, unitCost: 3, active: false, imageKey: "arroz" }),
];

function demoMovement(input: {
  id: string;
  itemId: string;
  type: InventoryMovement["type"];
  quantity: number;
  quantityDelta?: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
  orderId?: string;
}): InventoryMovement {
  const item = DEMO_INVENTORY_ITEMS.find((candidate) => candidate.id === input.itemId)!;
  const quantityDelta = input.quantityDelta ?? (input.type === "consumption" || input.type === "waste" ? -input.quantity : input.quantity);
  return {
    ...input,
    quantityDelta,
    baseQuantityDelta: toBaseQuantity(Math.abs(quantityDelta), item.unit) * Math.sign(quantityDelta),
    balanceBefore: toBaseQuantity(input.balanceBefore, item.unit),
    balanceAfter: toBaseQuantity(input.balanceAfter, item.unit),
    idempotencyKey: `demo:${input.id}`,
  };
}

export const DEMO_INVENTORY_MOVEMENTS: InventoryMovement[] = [
  demoMovement({ id: "mov-carne-res-compra", itemId: "inv-carne-res", type: "purchase", quantity: 8, balanceBefore: 10.5, balanceAfter: 18.5, reason: "Entrada por compra", createdAt: "2026-08-04T08:15:00-05:00" }),
  demoMovement({ id: "mov-costilla-merma", itemId: "inv-costilla", type: "waste", quantity: 0.4, balanceBefore: 1.2, balanceAfter: 0.8, reason: "Ajuste por merma", createdAt: "2026-08-04T09:10:00-05:00" }),
  demoMovement({ id: "mov-arroz-consumo", itemId: "inv-arroz", type: "consumption", quantity: 4.5, balanceBefore: 29.5, balanceAfter: 25, reason: "Salida por pedido", createdAt: "2026-08-04T10:30:00-05:00", orderId: "demo-order-1254" }),
  demoMovement({ id: "mov-cerdo-consumo", itemId: "inv-cerdo", type: "consumption", quantity: 1.2, balanceBefore: 4.4, balanceAfter: 3.2, reason: "Salida por pedido", createdAt: "2026-08-04T11:05:00-05:00", orderId: "demo-order-1255" }),
  demoMovement({ id: "mov-verduras-compra", itemId: "inv-verduras", type: "purchase", quantity: 3, balanceBefore: 6, balanceAfter: 9, reason: "Entrada por compra", createdAt: "2026-08-03T16:20:00-05:00" }),
];

export const DEMO_ADMIN_METRICS = {
  ordersToday: 48,
  salesToday: 2156000,
  pensionersActive: 36,
  pendingDeliveries: 7,
} as const;

export const DEMO_RECENT_ORDERS = [
  { id: "demo-order-1258", label: "#1258", channel: "Domicilio", time: "10:24 a. m.", status: "Nuevo" },
  { id: "demo-order-1257", label: "#1257", channel: "Domicilio", time: "10:10 a. m.", status: "En cocina" },
  { id: "demo-order-1256", label: "#1256", channel: "Mesa 12", time: "09:58 a. m.", status: "Listo" },
] as const;
