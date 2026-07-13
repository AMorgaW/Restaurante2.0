import { describe, expect, it } from "vitest";
import {
  buildLineId,
  calculateTotals,
  cartItemCount,
  cartSubtotal,
  couponDiscount,
  lineTotal,
  sanitizeQuantity,
  unitPriceWithModifiers,
} from "@/features/cart/calculations";
import type { CartItem } from "@/types/order";
import type { Coupon } from "@/types/restaurant";

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    lineId: "item-1",
    itemId: "item-1",
    slug: "item-1",
    nameSnapshot: "Plato de prueba",
    unitPriceSnapshot: 10000,
    quantity: 2,
    notes: "",
    modifiers: [],
    imagePath: "/generated/menu/item-1.jpg",
    ...overrides,
  };
}

const percentCoupon: Coupon = {
  code: "DIEZ",
  type: "percent",
  value: 10,
  description: "10%",
  active: true,
};

describe("sanitizeQuantity", () => {
  it("normaliza valores inválidos a 1", () => {
    expect(sanitizeQuantity(Number.NaN, 20)).toBe(1);
    expect(sanitizeQuantity(Number.POSITIVE_INFINITY, 20)).toBe(1);
    expect(sanitizeQuantity(-5, 20)).toBe(1);
    expect(sanitizeQuantity(0, 20)).toBe(1);
  });

  it("trunca decimales y respeta el máximo", () => {
    expect(sanitizeQuantity(2.9, 20)).toBe(2);
    expect(sanitizeQuantity(999, 20)).toBe(20);
  });
});

describe("unitPriceWithModifiers y lineTotal", () => {
  it("suma modificadores al precio unitario", () => {
    const item = makeItem({
      modifiers: [
        { groupId: "extras", groupName: "Extras", optionId: "a", optionName: "A", priceSnapshot: 4000 },
        { groupId: "extras", groupName: "Extras", optionId: "b", optionName: "B", priceSnapshot: 2500 },
      ],
    });
    expect(unitPriceWithModifiers(item)).toBe(16500);
    expect(lineTotal(item)).toBe(33000);
  });
});

describe("cartSubtotal y cartItemCount", () => {
  it("suma líneas y unidades", () => {
    const items = [makeItem(), makeItem({ lineId: "x", quantity: 1, unitPriceSnapshot: 5000 })];
    expect(cartSubtotal(items)).toBe(25000);
    expect(cartItemCount(items)).toBe(3);
  });
});

describe("couponDiscount", () => {
  it("aplica porcentaje redondeado", () => {
    expect(couponDiscount(25500, percentCoupon)).toBe(2550);
  });

  it("aplica descuento fijo sin superar el subtotal", () => {
    const fixed: Coupon = { code: "FIJO", type: "fixed", value: 8000, description: "", active: true };
    expect(couponDiscount(25000, fixed)).toBe(8000);
    expect(couponDiscount(5000, fixed)).toBe(5000);
  });

  it("ignora cupones inactivos o subtotal cero", () => {
    expect(couponDiscount(10000, { ...percentCoupon, active: false })).toBe(0);
    expect(couponDiscount(0, percentCoupon)).toBe(0);
    expect(couponDiscount(10000, null)).toBe(0);
  });

  it("limita el porcentaje a 0..100", () => {
    expect(couponDiscount(10000, { ...percentCoupon, value: 150 })).toBe(10000);
    expect(couponDiscount(10000, { ...percentCoupon, value: -5 })).toBe(0);
  });
});

describe("calculateTotals", () => {
  it("calcula el flujo completo: descuento, impuesto, servicio, domicilio y propina", () => {
    const totals = calculateTotals({
      items: [makeItem()], // subtotal 20000
      coupon: percentCoupon, // -2000
      taxRate: 0.08, // sobre 18000 → 1440
      serviceFeeRate: 0.05, // 900
      deliveryFee: 6000,
      tipPercent: 10, // 1800
    });
    expect(totals).toEqual({
      subtotal: 20000,
      discount: 2000,
      tax: 1440,
      serviceFee: 900,
      deliveryFee: 6000,
      tip: 1800,
      total: 28140,
    });
  });

  it("con carrito vacío todo es cero salvo el domicilio explícito", () => {
    const totals = calculateTotals({
      items: [],
      taxRate: 0.08,
      serviceFeeRate: 0,
      deliveryFee: 0,
      tipPercent: 10,
    });
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("nunca produce importes negativos", () => {
    const totals = calculateTotals({
      items: [makeItem({ quantity: 1, unitPriceSnapshot: 1000 })],
      coupon: { code: "F", type: "fixed", value: 99999, description: "", active: true },
      taxRate: 0.08,
      serviceFeeRate: 0,
      deliveryFee: -50, // entrada corrupta
      tipPercent: 0,
    });
    expect(totals.discount).toBe(1000);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.total).toBe(0);
  });
});

describe("buildLineId", () => {
  it("agrupa por plato y modificadores ordenados", () => {
    const a = buildLineId("plato", [
      { groupId: "g1", optionId: "o2" },
      { groupId: "g1", optionId: "o1" },
    ]);
    const b = buildLineId("plato", [
      { groupId: "g1", optionId: "o1" },
      { groupId: "g1", optionId: "o2" },
    ]);
    expect(a).toBe(b);
    expect(buildLineId("plato", [])).toBe("plato");
    expect(a).not.toBe("plato");
  });
});
