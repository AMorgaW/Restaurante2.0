import { describe, expect, it } from "vitest";
import { DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS } from "@/lib/inventory/fixtures";
import { getInventoryDemoImage } from "@/lib/inventory/images";
import { addInventoryItem, adjustInventoryQuantity, deleteInventoryItem, receiveInventoryQuantity, recordInventoryWaste } from "@/lib/inventory/operations";
import { filterInventory, getInventoryStatus, getInventorySummary } from "@/lib/inventory/selectors";

describe("inventario demo local", () => {
  it("calcula estados sin duplicar reglas en componentes", () => {
    expect(getInventoryStatus(DEMO_INVENTORY_ITEMS.find((item) => item.id === "inv-carne-res")!)).toBe("available");
    expect(getInventoryStatus(DEMO_INVENTORY_ITEMS.find((item) => item.id === "inv-cerdo")!)).toBe("low");
    expect(getInventoryStatus(DEMO_INVENTORY_ITEMS.find((item) => item.id === "inv-costilla")!)).toBe("critical");
    expect(getInventoryStatus(DEMO_INVENTORY_ITEMS.find((item) => item.id === "inv-leche")!)).toBe("out");
    expect(getInventoryStatus(DEMO_INVENTORY_ITEMS.find((item) => item.id === "inv-sal")!)).toBe("inactive");
  });

  it("comparte métricas y movimientos entre dashboard e inventario", () => {
    const summary = getInventorySummary(DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS, new Date("2026-08-04T12:00:00-05:00"));
    expect(summary.active).toBe(10);
    expect(summary.critical).toBe(1);
    expect(summary.out).toBe(1);
    expect(summary.estimatedValue).toBeGreaterThan(0);
    expect(summary.consumptionToday).toBe(5.7);
    expect(summary.recentMovements[0]?.id).toBe("mov-cerdo-consumo");
  });

  it("filtra por búsqueda, categoría, estado y actividad", () => {
    expect(filterInventory(DEMO_INVENTORY_ITEMS, { search: "arroz", category: "all", status: "all", activity: "all" }).map((item) => item.name)).toEqual(["Arroz"]);
    expect(filterInventory(DEMO_INVENTORY_ITEMS, { search: "", category: "Carnes", status: "all", activity: "active" })).toHaveLength(3);
    expect(filterInventory(DEMO_INVENTORY_ITEMS, { search: "", category: "all", status: "critical", activity: "all" }).map((item) => item.name)).toEqual(["Costilla"]);
    expect(filterInventory(DEMO_INVENTORY_ITEMS, { search: "", category: "all", status: "all", activity: "inactive" }).map((item) => item.name)).toEqual(["Sal de cocina"]);
  });

  it("valida entradas, ajustes y mermas con unidades locales", () => {
    const added = addInventoryItem([], [], { name: "Harina", category: "Despensa", unit: "g", quantity: 500, minimumQuantity: 100, active: true }, 1);
    expect(added.items[0]?.unit).toBe("g");
    expect(added.movements[0]?.type).toBe("initial_balance");
    const received = receiveInventoryQuantity(added.items, added.movements, added.items[0]!.id, 200, "Compra", added.nextId);
    expect(received.items[0]?.quantity).toBe(700);
    const adjusted = adjustInventoryQuantity(received.items, received.movements, added.items[0]!.id, 650, "Conteo físico", received.nextId);
    expect(adjusted.items[0]?.quantity).toBe(650);
    const wasted = recordInventoryWaste(adjusted.items, adjusted.movements, added.items[0]!.id, 50, "Producto dañado", adjusted.nextId);
    expect(wasted.items[0]?.quantity).toBe(600);
    expect(() => recordInventoryWaste(wasted.items, wasted.movements, added.items[0]!.id, 601, "Exceso", wasted.nextId)).toThrow(/superar/i);
    expect(() => receiveInventoryQuantity(wasted.items, wasted.movements, added.items[0]!.id, 0, "Compra", wasted.nextId)).toThrow(/mayor que cero/i);
  });

  it("impide borrar insumos con historia y centraliza imagen temporal", () => {
    expect(() => deleteInventoryItem(DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS, "inv-arroz")).toThrow(/historia demo/i);
    expect(getInventoryDemoImage({ imageKey: "carne" })).toContain("generated/menu/");
    const disposable = addInventoryItem([], [], { name: "Prueba", category: "Despensa", unit: "unidad", quantity: 0, minimumQuantity: 1, active: true }, 1);
    expect(deleteInventoryItem(disposable.items, disposable.movements, disposable.items[0]!.id)).toEqual([]);
  });
});
