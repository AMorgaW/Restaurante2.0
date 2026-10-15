import { describe, expect, it } from "vitest";
import { checkoutInputSchema } from "@/features/checkout/schema";

const validCheckout = {
  idempotencyKey: "3b241101-e2bb-4255-8caf-4136c566a962",
  branchId: "branch-centro",
  fulfillmentType: "pickup" as const,
  customer: { name: "Ana Pérez", phone: "+57 300 123 4567", email: "ana@example.com" },
  items: [{ slug: "carne-asada", quantity: 2, notes: "", modifiers: [] }],
  tipPercent: 10,
  notes: "",
};

describe("checkoutInputSchema", () => {
  it("acepta un pedido de recogida válido", () => {
    const result = checkoutInputSchema.safeParse(validCheckout);
    expect(result.success).toBe(true);
  });

  it("valida una credencial de comprobante Base64URL canónica", () => {
    expect(
      checkoutInputSchema.safeParse({ ...validCheckout, receiptKey: "A".repeat(43) }).success,
    ).toBe(true);
    expect(
      checkoutInputSchema.safeParse({ ...validCheckout, receiptKey: "A".repeat(42) }).success,
    ).toBe(false);
  });

  it("exige dirección cuando es domicilio", () => {
    const result = checkoutInputSchema.safeParse({
      ...validCheckout,
      fulfillmentType: "delivery",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("address"))).toBe(true);
    }
  });

  it("acepta domicilio con dirección", () => {
    const result = checkoutInputSchema.safeParse({
      ...validCheckout,
      fulfillmentType: "delivery",
      address: { street: "Calle 10 # 5-51", details: "", neighborhood: "" },
    });
    expect(result.success).toBe(true);
  });

  it("rechaza carrito vacío, cantidades inválidas y correos malformados", () => {
    expect(checkoutInputSchema.safeParse({ ...validCheckout, items: [] }).success).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...validCheckout,
        items: [{ slug: "x", quantity: 0, notes: "", modifiers: [] }],
      }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...validCheckout,
        items: [{ slug: "x", quantity: 2.5, notes: "", modifiers: [] }],
      }).success,
    ).toBe(false);
    expect(
      checkoutInputSchema.safeParse({
        ...validCheckout,
        customer: { ...validCheckout.customer, email: "no-es-correo" },
      }).success,
    ).toBe(false);
  });

  it("rechaza teléfonos inválidos y normaliza el cupón a mayúsculas", () => {
    expect(
      checkoutInputSchema.safeParse({
        ...validCheckout,
        customer: { ...validCheckout.customer, phone: "123" },
      }).success,
    ).toBe(false);

    const parsed = checkoutInputSchema.safeParse({ ...validCheckout, couponCode: "bienvenida10" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.couponCode).toBe("BIENVENIDA10");
  });
});
