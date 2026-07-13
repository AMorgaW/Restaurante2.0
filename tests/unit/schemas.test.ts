import { describe, expect, it } from "vitest";
import { checkoutInputSchema } from "@/features/checkout/schema";
import { reservationInputSchema } from "@/features/reservations/schema";

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

const validReservation = {
  branchId: "branch-centro",
  date: "2030-01-15",
  time: "19:00",
  partySize: 4,
  customerName: "Ana Pérez",
  phone: "+57 300 123 4567",
  email: "ana@example.com",
  marketingConsent: false,
};

describe("reservationInputSchema", () => {
  it("acepta una reserva válida", () => {
    expect(reservationInputSchema.safeParse(validReservation).success).toBe(true);
  });

  it("rechaza formatos de fecha y hora inválidos", () => {
    expect(
      reservationInputSchema.safeParse({ ...validReservation, date: "15/01/2030" }).success,
    ).toBe(false);
    expect(reservationInputSchema.safeParse({ ...validReservation, time: "7pm" }).success).toBe(
      false,
    );
  });

  it("limita el tamaño del grupo", () => {
    expect(reservationInputSchema.safeParse({ ...validReservation, partySize: 0 }).success).toBe(
      false,
    );
    expect(reservationInputSchema.safeParse({ ...validReservation, partySize: 13 }).success).toBe(
      false,
    );
    expect(reservationInputSchema.safeParse({ ...validReservation, partySize: 2.5 }).success).toBe(
      false,
    );
  });

  it("exige nombre, teléfono y correo válidos", () => {
    expect(
      reservationInputSchema.safeParse({ ...validReservation, customerName: "A" }).success,
    ).toBe(false);
    expect(reservationInputSchema.safeParse({ ...validReservation, phone: "12" }).success).toBe(
      false,
    );
    expect(
      reservationInputSchema.safeParse({ ...validReservation, email: "correo" }).success,
    ).toBe(false);
  });

  it("el consentimiento de marketing es opcional y por defecto false", () => {
    const { marketingConsent: _omitted, ...withoutConsent } = validReservation;
    const parsed = reservationInputSchema.safeParse(withoutConsent);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.marketingConsent).toBe(false);
  });
});
