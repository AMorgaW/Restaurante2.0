import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ enabled: true }));
const readReceipt = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env/server", () => ({
  isGuestReceiptRecoveryEnabled: () => env.enabled,
}));
vi.mock("@/server/guest-receipts/read", () => ({
  readGuestOrderReceipt: readReceipt,
}));

import { POST } from "@/app/api/order-receipt/route";

const receiptKey = "A".repeat(43);
const receipt = {
  orderNumber: "BS-1001",
  status: "pending",
  paymentStatus: "pending",
  paymentMethod: "demo",
  fulfillmentType: "pickup",
  branchName: "Sucursal Centro",
  currency: "COP",
  items: [{ name: "Plato de prueba", quantity: 1, modifiers: [], total: 24000 }],
  subtotal: 24000,
  discount: 0,
  tax: 0,
  serviceFee: 0,
  deliveryFee: 0,
  tip: 0,
  total: 24000,
};

function request(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost/api/order-receipt", {
    method: "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: JSON.stringify(body),
    ...init,
  }) as never;
}

describe("POST /api/order-receipt", () => {
  beforeEach(() => {
    env.enabled = true;
    readReceipt.mockReset();
  });

  it("lee solo con la clave y devuelve el DTO seguro con headers privados", async () => {
    readReceipt.mockResolvedValue(receipt);
    const response = await POST(request({ receiptKey }));

    expect(response.status).toBe(200);
    expect(readReceipt).toHaveBeenCalledWith(receiptKey);
    expect(await response.json()).toEqual({ receipt });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, noarchive");
  });

  it.each([
    "not-a-key",
    "B".repeat(43),
    "A".repeat(42),
  ])("responde 404 neutral a una clave no canónica (%s)", async (invalidKey) => {
    const response = await POST(request({ receiptKey: invalidKey }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No hay un comprobante disponible con esa clave.",
      code: "receipt-unavailable",
    });
    expect(readReceipt).not.toHaveBeenCalled();
  });

  it("mantiene indistinguibles una clave válida sin filas y una clave revocada o vencida", async () => {
    readReceipt.mockResolvedValue(null);
    const first = await POST(request({ receiptKey }));
    readReceipt.mockResolvedValue(null);
    const second = await POST(request({ receiptKey }));
    expect(first.status).toBe(404);
    expect(second.status).toBe(404);
    expect(await first.text()).toBe(await second.text());
  });

  it("devuelve 503 neutral si la RPC o la infraestructura no están disponibles", async () => {
    readReceipt.mockRejectedValue(new Error("internal SQL details must not escape"));
    const response = await POST(request({ receiptKey }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      error: "La recuperación de comprobantes no está disponible temporalmente.",
      code: "receipt-recovery-unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("internal SQL");
  });

  it("responde 503 sin leer el secreto cuando el flag está apagado", async () => {
    env.enabled = false;
    const response = await POST(request({ receiptKey }));
    expect(response.status).toBe(503);
    expect(readReceipt).not.toHaveBeenCalled();
  });

  it("rechaza un cuerpo mayor a 1 KiB durante la lectura", async () => {
    const response = await POST(request({ receiptKey, padding: "x".repeat(1500) }));
    expect(response.status).toBe(413);
    expect(readReceipt).not.toHaveBeenCalled();
  });

  it("no convierte un fallo de validación del lector en éxito", async () => {
    readReceipt.mockRejectedValue(new Error("projection invalid"));
    const response = await POST(request({ receiptKey }));
    expect(response.status).toBe(503);
  });
});
