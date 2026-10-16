import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAnonClient: () => ({ rpc }),
}));

import { GuestReceiptReadError, readGuestOrderReceipt } from "@/server/guest-receipts/read";

const key = "A".repeat(43);
const row = {
  order_number: "BS-1001",
  status: "confirmed",
  payment_status: "pending",
  payment_method: "demo",
  fulfillment_type: "delivery",
  branch_name: null,
  currency: "COP",
  items: [
    {
      name: "Plato snapshot",
      quantity: 2,
      modifiers: [{ groupName: "Sopa", optionName: "Opción snapshot", price: 0 }],
      total: 30000,
    },
  ],
  subtotal: 30000,
  discount: 0,
  tax: 0,
  service_fee: 0,
  delivery_fee: 0,
  tip: 0,
  total: 30000,
};

describe("lector de comprobantes de invitado", () => {
  beforeEach(() => rpc.mockReset());

  it("usa el RPC público con el cliente anon y mapea snake_case explícitamente", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    await expect(readGuestOrderReceipt(key)).resolves.toEqual({
      orderNumber: "BS-1001",
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "demo",
      fulfillmentType: "delivery",
      branchName: null,
      currency: "COP",
      items: [{ name: "Plato snapshot", quantity: 2, modifiers: [{ groupName: "Sopa", optionName: "Opción snapshot", price: 0 }], total: 30000 }],
      subtotal: 30000,
      discount: 0,
      tax: 0,
      serviceFee: 0,
      deliveryFee: 0,
      tip: 0,
      total: 30000,
    });
    expect(rpc).toHaveBeenCalledWith("read_guest_order_receipt", { p_receipt_key: key });
  });

  it("representa una clave válida sin filas como comprobante no disponible", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(readGuestOrderReceipt(key)).resolves.toBeNull();
  });

  it("rechaza una respuesta que intenta añadir PII o campos no autorizados", async () => {
    rpc.mockResolvedValue({ data: [{ ...row, customer_email: "private@example.test" }], error: null });
    await expect(readGuestOrderReceipt(key)).rejects.toMatchObject({ kind: "projection" });
  });

  it("clasifica errores de RPC sin conservar su detalle", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "private SQL detail" } });
    await expect(readGuestOrderReceipt(key)).rejects.toEqual(expect.any(GuestReceiptReadError));
    await expect(readGuestOrderReceipt(key)).rejects.toMatchObject({ kind: "backend" });
  });
});
