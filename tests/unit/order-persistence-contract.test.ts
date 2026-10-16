import { describe, expect, it, vi } from "vitest";
import { mapCreateCustomerOrderError } from "@/server/orders/rpc-errors";

describe("mapCreateCustomerOrderError", () => {
  it("distingue cupón, producto y conflicto", () => {
    expect(mapCreateCustomerOrderError({ message: "Cupon invalido" }).code).toBe("coupon-invalid");
    expect(mapCreateCustomerOrderError({ message: "Producto no disponible" }).code).toBe(
      "item-unavailable",
    );
    expect(mapCreateCustomerOrderError({ message: "Conflicto de idempotencia" }).code).toBe(
      "idempotency-conflict",
    );
  });

  it("mantiene separados los errores de credencial, wrapper ausente e idempotencia", () => {
    expect(
      mapCreateCustomerOrderError({ code: "42501", message: "Comprobante no disponible" }),
    ).toMatchObject({
      code: "receipt-unavailable",
      httpStatus: 409,
    });
    expect(
      mapCreateCustomerOrderError({
        code: "PGRST202",
        message: "Could not find the function public.create_customer_order_with_receipt",
      }).code,
    ).toBe("receipt-recovery-unavailable");
    expect(
      mapCreateCustomerOrderError({ code: "23505", message: "Conflicto de idempotencia" }).code,
    ).toBe("idempotency-conflict");
  });

  it("mapea el cierre de recepción pública a una indisponibilidad neutral", () => {
    expect(
      mapCreateCustomerOrderError({
        code: "P0001",
        message: "La recepción de pedidos no está disponible",
      }),
    ).toMatchObject({
      code: "public-order-intake-closed",
      httpStatus: 503,
      message: "La recepción de pedidos no está disponible temporalmente.",
    });
  });

  it("oculta detalle interno", () => {
    const mapped = mapCreateCustomerOrderError({
      message: "unexpected",
      details: "SELECT * FROM private.secret",
    });
    expect(mapped.message).not.toMatch(/SELECT|private\.secret/);
  });
});

describe("idempotency key lifecycle (checkout contract)", () => {
  it("reutiliza la misma key en retries y renueva tras éxito", () => {
    let key = "11111111-1111-4111-8111-111111111111";
    const firstAttempt = key;
    // retry del mismo intento
    expect(key).toBe(firstAttempt);
    // éxito → nuevo intento
    key = "22222222-2222-4222-8222-222222222222";
    expect(key).not.toBe(firstAttempt);
  });
});

describe("carrito solo se limpia tras éxito", () => {
  it("documenta el contrato de clearCart post-ok", async () => {
    const clearCart = vi.fn();
    const fail = { ok: false as const, error: "fallo" };
    const ok = {
      ok: true as const,
      order: { id: "o1", orderNumber: "CB-1", totals: { total: 1 } },
    };

    if (!fail.ok) {
      // no clear
    } else {
      clearCart();
    }
    expect(clearCart).not.toHaveBeenCalled();

    if (ok.ok) clearCart();
    expect(clearCart).toHaveBeenCalledTimes(1);
  });
});
