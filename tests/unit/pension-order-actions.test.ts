import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  dataMode: { mode: "supabase", configured: true, missing: [], invalid: [] },
  enabled: false,
  placePensionOrder: vi.fn(),
}));

vi.mock("@/lib/env/server", () => ({
  getDataModeStatus: () => harness.dataMode,
  isPublicOrderIntakeEnabled: () => harness.enabled,
}));
vi.mock("@/server/pension/service", () => ({
  placePensionOrder: harness.placePensionOrder,
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { placePensionOrderAction } from "@/app/pensionado/pension-order-actions";

describe("placePensionOrderAction public intake gate", () => {
  beforeEach(() => {
    harness.dataMode = { mode: "supabase", configured: true, missing: [], invalid: [] };
    harness.enabled = false;
    harness.placePensionOrder.mockReset();
  });

  it("falla cerrado antes del servicio cuando la recepción está desactivada", async () => {
    await expect(placePensionOrderAction({})).resolves.toEqual({
      ok: false,
      message: "La recepción de pedidos no está disponible temporalmente.",
      code: "public-order-intake-closed",
    });
    expect(harness.placePensionOrder).not.toHaveBeenCalled();
  });

  it("conserva el servicio existente cuando la compuerta está abierta", async () => {
    harness.enabled = true;
    harness.placePensionOrder.mockResolvedValue({
      replay: false,
      orderNumber: "P-1",
    });

    await expect(placePensionOrderAction({ input: true })).resolves.toMatchObject({
      ok: true,
      code: "ok",
    });
    expect(harness.placePensionOrder).toHaveBeenCalledWith({ input: true });
  });
});
