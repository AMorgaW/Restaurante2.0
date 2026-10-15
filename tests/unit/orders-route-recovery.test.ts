import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  dataMode: { mode: "supabase", configured: true, missing: [], invalid: [] } as {
    mode: "local" | "supabase" | "invalid";
    configured: boolean;
    missing: string[];
    invalid: string[];
  },
  enabled: true,
}));
const placeOrder = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env/server", () => ({
  getDataModeStatus: () => env.dataMode,
  isGuestReceiptRecoveryEnabled: () => env.enabled,
}));
vi.mock("@/server/services/orders", () => ({
  OrderValidationError: class extends Error {},
  placeOrder,
}));
vi.mock("@/server/orders/rpc-errors", () => ({
  OrderPersistenceError: class extends Error {},
}));

import { POST } from "@/app/api/orders/route";

const validBody = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  branchId: "branch-centro",
  fulfillmentType: "pickup",
  customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
  items: [{ slug: "carne-asada", quantity: 1, notes: "", modifiers: [] }],
  tipPercent: 0,
  notes: "",
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API orders C2.2 capability gate", () => {
  beforeEach(() => {
    env.dataMode = { mode: "supabase", configured: true, missing: [], invalid: [] };
    env.enabled = true;
    placeOrder.mockReset();
  });

  it("exige receiptKey antes de invocar el servicio cuando está habilitado", async () => {
    const response = await POST(request(validBody) as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "receipt-recovery-required" });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("no acepta receiptKey cuando la capacidad está desactivada", async () => {
    env.enabled = false;
    const response = await POST(request({ ...validBody, receiptKey: "A".repeat(43) }) as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "receipt-recovery-unavailable" });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("no permite credenciales en DATA_MODE local", async () => {
    env.dataMode = { mode: "local", configured: false, missing: [], invalid: [] };
    env.enabled = false;
    const response = await POST(request({ ...validBody, receiptKey: "A".repeat(43) }) as never);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: "receipt-recovery-unavailable" });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("deja pasar la entrada válida al servicio sin cambiar el contrato de Order", async () => {
    const receiptKey = "A".repeat(43);
    const order = { id: "22222222-2222-4222-8222-222222222222", orderNumber: "CB-1" };
    placeOrder.mockResolvedValue(order);
    const response = await POST(request({ ...validBody, receiptKey }) as never);
    expect(response.status).toBe(201);
    expect(placeOrder).toHaveBeenCalledWith(expect.objectContaining({ receiptKey }));
    await expect(response.json()).resolves.toEqual({ order });
  });
});
