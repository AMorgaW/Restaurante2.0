import { describe, expect, it } from "vitest";
import { DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS } from "@/lib/inventory/fixtures";
import { consumeOrderForDelivery, calculateExpectedConsumption, reverseInventoryConsumption } from "@/lib/inventory/consumption";
import { createRecipe, DEMO_RECIPES, InventoryRecipeError } from "@/lib/inventory/recipes";
import { fromBaseQuantity, toBaseQuantity, convertQuantity, areUnitsCompatible, formatQuantity } from "@/lib/inventory/units";
import { deactivateInventoryItem, deleteInventoryItem, updateInventoryItem } from "@/lib/inventory/operations";
import { LocalInventoryAdapter } from "@/lib/inventory/repository";
import type { Order } from "@/types/order";

const demoOrder = (productId: string, quantity = 1): Order => ({
  id: "order-domain-1",
  orderNumber: "CB-DOMAIN-1",
  branchId: "branch-centro",
  status: "delivered",
  paymentStatus: "paid",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  items: [{ itemId: productId, slug: productId, nameSnapshot: "Plato demo", unitPrice: 43000, quantity, modifiers: [], notes: "", total: 43000 * quantity }],
  totals: { subtotal: 43000 * quantity, discount: 0, tax: 0, serviceFee: 0, deliveryFee: 0, tip: 0, total: 43000 * quantity },
  currency: "COP",
  customer: { name: "Cliente demo", phone: "3000000000", email: "cliente@example.test" },
  notes: "",
  createdAt: "2026-08-04T12:00:00-05:00",
});

describe("dominio de unidades y cantidades", () => {
  it("convierte kg↔g y L↔ml sin perder precisión fija", () => {
    expect(convertQuantity(1.25, "kg", "g")).toBe(1250);
    expect(convertQuantity(1250, "g", "kg")).toBe(1.25);
    expect(convertQuantity(2.5, "L", "ml")).toBe(2500);
    expect(convertQuantity(2500, "ml", "L")).toBe(2.5);
    expect(fromBaseQuantity(toBaseQuantity(1.234, "kg"), "kg")).toBe(1.234);
    expect(formatQuantity(1.234, "kg")).toMatch(/1,234\s*kg/);
  });

  it("rechaza conversiones incompatibles, negativos y fracciones contables", () => {
    expect(areUnitsCompatible("kg", "g")).toBe(true);
    expect(areUnitsCompatible("kg", "ml")).toBe(false);
    expect(() => convertQuantity(1, "kg", "ml")).toThrow(/convertir/i);
    expect(() => toBaseQuantity(-1, "g")).toThrow(/negativa/i);
    expect(() => toBaseQuantity(1.5, "unidad")).toThrow(/enteras/i);
    expect(toBaseQuantity(0, "ml")).toBe(0);
  });
});

describe("recetas y consumo de inventario", () => {
  it("valida ingredientes duplicados, inactivos y unidades incompatibles", () => {
    const base = { productId: "producto-demo", portionYield: 1, isActive: true } as const;
    expect(() => createRecipe({ ...base, items: [{ inventoryItemId: "inv-arroz", quantityRequired: 1, baseUnit: "g" }, { inventoryItemId: "inv-arroz", quantityRequired: 1, baseUnit: "g" }] }, DEMO_INVENTORY_ITEMS)).toThrow(InventoryRecipeError);
    expect(() => createRecipe({ ...base, items: [{ inventoryItemId: "inv-sal", quantityRequired: 1, baseUnit: "g" }] }, DEMO_INVENTORY_ITEMS)).toThrow(/inactivo/i);
    expect(() => createRecipe({ ...base, items: [{ inventoryItemId: "inv-arroz", quantityRequired: 1, baseUnit: "ml" }] }, DEMO_INVENTORY_ITEMS)).toThrow(/compatible/i);
  });

  it("agrupa ingredientes compartidos y consume una sola vez", () => {
    const order = demoOrder(DEMO_RECIPES[0]!.productId, 2);
    const first = consumeOrderForDelivery(DEMO_INVENTORY_ITEMS, [], order, DEMO_RECIPES, "ready", "admin-demo", new Date("2026-08-04T12:30:00-05:00"));
    expect(first.consumed).toBe(true);
    expect(first.replayed).toBe(false);
    expect(first.requirements.length).toBe(3);
    expect(first.movements.filter((movement) => movement.type === "consumption")).toHaveLength(3);
    const second = consumeOrderForDelivery(first.items, first.movements, order, DEMO_RECIPES, "ready", "admin-demo", new Date("2026-08-04T12:31:00-05:00"));
    expect(second.replayed).toBe(true);
    expect(second.movements).toHaveLength(first.movements.length);
  });

  it("agrupa un ingrediente compartido entre productos distintos", () => {
    const firstProduct = DEMO_RECIPES[0]!.productId;
    const secondProduct = DEMO_RECIPES[1]!.productId;
    const order = {
      ...demoOrder(firstProduct),
      items: [
        { ...demoOrder(firstProduct).items[0]!, itemId: firstProduct, slug: firstProduct },
        { ...demoOrder(secondProduct).items[0]!, itemId: secondProduct, slug: secondProduct },
      ],
    };
    const result = consumeOrderForDelivery(DEMO_INVENTORY_ITEMS, [], order, DEMO_RECIPES, "ready");
    expect(result.movements.filter((movement) => movement.type === "consumption")).toHaveLength(4);
    expect(result.requirements.find((requirement) => requirement.inventoryItemId === "inv-carne-res")?.requiredBaseQuantity).toBe(340000);
  });

  it("mantiene idempotencia al pasar por el adaptador local", () => {
    const adapter = new LocalInventoryAdapter({ items: DEMO_INVENTORY_ITEMS, movements: [], recipes: DEMO_RECIPES, nextId: 1 });
    const order = demoOrder(DEMO_RECIPES[0]!.productId);
    expect(adapter.consumeDeliveredOrder(order, "ready").replayed).toBe(false);
    expect(adapter.consumeDeliveredOrder(order, "ready").replayed).toBe(true);
    expect(adapter.snapshot().movements.filter((movement) => movement.type === "consumption")).toHaveLength(3);
  });

  it("falla completo con receta ausente, stock insuficiente o transición inválida", () => {
    expect(() => calculateExpectedConsumption(DEMO_INVENTORY_ITEMS, DEMO_RECIPES, demoOrder("sopa-de-maiz-con-arroz-y-frijoles"))).toThrow(/sin receta/i);
    const emptyBeef = DEMO_INVENTORY_ITEMS.map((item) => item.id === "inv-carne-res" ? { ...item, baseQuantity: 0, quantity: 0 } : item);
    expect(() => calculateExpectedConsumption(emptyBeef, DEMO_RECIPES, demoOrder(DEMO_RECIPES[0]!.productId))).toThrow(/insuficiente/i);
    expect(() => consumeOrderForDelivery(DEMO_INVENTORY_ITEMS, [], demoOrder(DEMO_RECIPES[0]!.productId), DEMO_RECIPES, "preparing")).toThrow(/transición/i);
  });

  it("revierte un consumo solo una vez y con rol privilegiado", () => {
    const first = consumeOrderForDelivery(DEMO_INVENTORY_ITEMS, [], demoOrder(DEMO_RECIPES[0]!.productId), DEMO_RECIPES, "ready");
    const movement = first.movements.find((candidate) => candidate.type === "consumption")!;
    expect(() => reverseInventoryConsumption(first.items, first.movements, movement.id, "manager", "Corrección")).toThrow(/owner o admin/i);
    const reversed = reverseInventoryConsumption(first.items, first.movements, movement.id, "owner", "Corrección", "owner-demo");
    expect(reversed.movements.at(-1)?.type).toBe("reversal");
    expect(reversed.items.find((item) => item.id === movement.itemId)?.baseQuantity).toBe(DEMO_INVENTORY_ITEMS.find((item) => item.id === movement.itemId)?.baseQuantity);
    expect(() => reverseInventoryConsumption(reversed.items, reversed.movements, movement.id, "admin", "Segunda corrección")).toThrow(/revertido/i);
  });

  it("no retira un insumo que una receta activa todavía utiliza", () => {
    expect(() => deactivateInventoryItem(DEMO_INVENTORY_ITEMS, "inv-carne-res", DEMO_RECIPES)).toThrow(/receta activa/i);
    expect(() => updateInventoryItem(DEMO_INVENTORY_ITEMS, "inv-carne-res", { active: false }, DEMO_RECIPES)).toThrow(/receta activa/i);
    expect(() => deleteInventoryItem(DEMO_INVENTORY_ITEMS, [], "inv-carne-res", DEMO_RECIPES)).toThrow(/receta activa/i);
    expect(() => deleteInventoryItem(DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS, "inv-carne-res", [])).toThrow(/historia/i);
  });
});
