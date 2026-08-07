import { describe, expect, it } from "vitest";
import {
  displayQuantityToBaseDelta,
  mapInventoryItemRow,
  mapInventoryMovementRow,
} from "@/server/inventory/mapper";

describe("inventory mapper supabase", () => {
  it("mapea unidades canónicas DB a presentación sin inventar stock", () => {
    const item = mapInventoryItemRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Harina",
      slug: "harina",
      category: "dry",
      base_unit: "g",
      display_unit: "kg",
      current_quantity: 1500,
      minimum_quantity: 500,
      cost_per_base_unit: 1,
      demo_image_key: null,
      is_active: true,
    });
    expect(item.quantity).toBe(1.5);
    expect(item.minimumQuantity).toBe(0.5);
    expect(item.baseUnit).toBe("g");
    expect(item.unit).toBe("kg");
    expect(displayQuantityToBaseDelta(1.5, "kg")).toBe(1500);
  });

  it("mapea consumption negativo en ledger", () => {
    const movement = mapInventoryMovementRow(
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        inventory_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        movement_type: "consumption",
        quantity_delta: -100,
        balance_before: 1500,
        balance_after: 1400,
        reason: "Salida",
        created_at: "2026-08-07T12:00:00.000Z",
        idempotency_key: "order:x:consumption:y",
        order_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        order_item_id: null,
        actor_profile_id: null,
        reversal_of_movement_id: null,
      },
      "kg",
    );
    expect(movement.quantityDelta).toBe(-0.1);
    expect(movement.quantity).toBe(0.1);
    expect(movement.type).toBe("consumption");
    expect(movement.orderId).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  });
});
