import type { CartItem, CartTotals } from "@/types/order";
import type { Coupon } from "@/types/restaurant";

/**
 * Cálculos del carrito: funciones puras, sin dependencia de la interfaz,
 * cubiertas por pruebas unitarias (tests/unit/cart-calculations.test.ts).
 * Todos los importes son enteros en unidades menores de la moneda.
 */

/** Normaliza una cantidad a un entero válido dentro de [1, max]. */
export function sanitizeQuantity(quantity: number, max: number): number {
  if (!Number.isFinite(quantity)) return 1;
  const floored = Math.floor(quantity);
  if (floored < 1) return 1;
  if (floored > max) return max;
  return floored;
}

/** Precio unitario efectivo de una línea (base + modificadores). */
export function unitPriceWithModifiers(item: Pick<CartItem, "unitPriceSnapshot" | "modifiers">): number {
  const modifiersTotal = item.modifiers.reduce((sum, modifier) => sum + modifier.priceSnapshot, 0);
  return item.unitPriceSnapshot + modifiersTotal;
}

/** Total de una línea del carrito. */
export function lineTotal(item: Pick<CartItem, "unitPriceSnapshot" | "modifiers" | "quantity">): number {
  return unitPriceWithModifiers(item) * item.quantity;
}

export function cartSubtotal(items: ReadonlyArray<CartItem>): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

/** Descuento aplicado por un cupón; nunca supera el subtotal. */
export function couponDiscount(subtotal: number, coupon: Coupon | null | undefined): number {
  if (!coupon || !coupon.active || subtotal <= 0) return 0;
  if (coupon.type === "percent") {
    const percent = Math.min(Math.max(coupon.value, 0), 100);
    return Math.round((subtotal * percent) / 100);
  }
  return Math.min(Math.max(Math.round(coupon.value), 0), subtotal);
}

export interface TotalsInput {
  items: ReadonlyArray<CartItem>;
  coupon?: Coupon | null;
  /** Tasa de impuesto (0.08 = 8%), aplicada sobre subtotal - descuento. */
  taxRate: number;
  /** Tarifa de servicio como tasa (0 desactiva). */
  serviceFeeRate: number;
  /** Tarifa de domicilio en unidades menores (0 para recogida). */
  deliveryFee: number;
  /** Propina en porcentaje (0, 5, 10, 15…). */
  tipPercent: number;
}

export function calculateTotals(input: TotalsInput): CartTotals {
  const subtotal = cartSubtotal(input.items);
  const discount = couponDiscount(subtotal, input.coupon);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(taxable * Math.max(input.taxRate, 0));
  const serviceFee = Math.round(taxable * Math.max(input.serviceFeeRate, 0));
  const deliveryFee = Math.max(Math.round(input.deliveryFee), 0);
  const tipPercent = Math.min(Math.max(input.tipPercent, 0), 100);
  const tip = Math.round((taxable * tipPercent) / 100);
  const total = taxable + tax + serviceFee + deliveryFee + tip;

  return { subtotal, discount, tax, serviceFee, deliveryFee, tip, total };
}

/** Número total de unidades del carrito (para el badge de navegación). */
export function cartItemCount(items: ReadonlyArray<CartItem>): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Identificador estable de línea: mismo plato + mismos modificadores
 * agrupan en la misma línea del carrito.
 */
export function buildLineId(
  itemId: string,
  modifiers: ReadonlyArray<{ groupId: string; optionId: string }>,
): string {
  const modifierKey = modifiers
    .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
    .sort()
    .join("|");
  return modifierKey.length > 0 ? `${itemId}__${modifierKey}` : itemId;
}
