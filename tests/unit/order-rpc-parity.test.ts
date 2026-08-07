import { describe, expect, it } from "vitest";
import { calculateTotals } from "@/features/cart/calculations";
import type { CartItem } from "@/types/order";

/**
 * Paridad con public.create_customer_order (0010):
 * mismos enteros y redondeo que la RPC PostgreSQL.
 */
describe("parity with create_customer_order totals", () => {
  it("reproduce el caso DIEZ + tip 10% de la suite SQL", () => {
    const items: CartItem[] = [
      {
        lineId: "rpc-main",
        itemId: "rpc-main",
        slug: "rpc-main",
        nameSnapshot: "RPC Main",
        unitPriceSnapshot: 20000,
        quantity: 2,
        notes: "sin cebolla",
        modifiers: [
          {
            groupId: "rpc-req",
            groupName: "Required",
            optionId: "rpc-req-a",
            optionName: "Req A",
            priceSnapshot: 0,
          },
          {
            groupId: "rpc-extra",
            groupName: "Extras",
            optionId: "rpc-extra-a",
            optionName: "Extra A",
            priceSnapshot: 4000,
          },
        ],
        imagePath: "/demo.jpg",
      },
    ];

    const totals = calculateTotals({
      items,
      coupon: {
        code: "DIEZ",
        type: "percent",
        value: 10,
        description: "10%",
        active: true,
      },
      taxRate: 0.08,
      serviceFeeRate: 0,
      deliveryFee: 0,
      tipPercent: 10,
    });

    expect(totals).toEqual({
      subtotal: 48000,
      discount: 4800,
      tax: 3456,
      serviceFee: 0,
      deliveryFee: 0,
      tip: 4320,
      total: 50976,
    });
  });

  it("reproduce precio de sucursal 12000 con impuesto 8%", () => {
    const totals = calculateTotals({
      items: [
        {
          lineId: "rpc-side",
          itemId: "rpc-side",
          slug: "rpc-side",
          nameSnapshot: "RPC Side",
          unitPriceSnapshot: 12000,
          quantity: 1,
          notes: "",
          modifiers: [],
          imagePath: "/demo.jpg",
        },
      ],
      taxRate: 0.08,
      serviceFeeRate: 0,
      deliveryFee: 0,
      tipPercent: 0,
    });
    expect(totals.total).toBe(12960);
  });
});
