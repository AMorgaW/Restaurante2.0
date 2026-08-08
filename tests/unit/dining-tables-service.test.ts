import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  resolve: vi.fn(),
}));
const dataMode = vi.hoisted(() => ({ value: "supabase" as "supabase" | "local" }));
const rpc = vi.hoisted(() => ({
  call: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getResolvedDataMode: () => dataMode.value,
}));
vi.mock("@/lib/session/server-resolver", () => ({
  resolveServerSession: () => session.resolve(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    rpc: (...args: unknown[]) => rpc.call(...args),
  }),
}));

import { DiningTablesError } from "@/server/dining-tables/errors";
import {
  confirmManualOrderPayment,
  createDiningTable,
  voidManualPaymentConfirmation,
} from "@/server/dining-tables/service";

const BRANCH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER = "11111111-1111-4111-8111-111111111111";
const CONFIRM = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";

function staffSession(role: string, status: "active" | "suspended" = "active") {
  return {
    kind: role,
    profile: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Staff",
      email: "staff@test.local",
      role,
      status,
      branchIds: [BRANCH],
    },
  };
}

describe("dining-tables service authz", () => {
  beforeEach(() => {
    dataMode.value = "supabase";
    session.resolve.mockReset();
    rpc.call.mockReset();
  });

  it("manager no puede createDiningTable (forbidden)", async () => {
    session.resolve.mockResolvedValue(staffSession("manager"));

    await expect(
      createDiningTable({ branchId: BRANCH, code: "1", name: "Mesa 1" }),
    ).rejects.toMatchObject({
      name: "DiningTablesError",
      code: "forbidden",
    });
    expect(rpc.call).not.toHaveBeenCalled();
  });

  it("cashier confirma cobro de pedido y llega al RPC (sin amount/role/branch)", async () => {
    session.resolve.mockResolvedValue(staffSession("cashier"));
    rpc.call.mockResolvedValue({
      data: {
        confirmation_id: CONFIRM,
        amount: 20000,
        method: "cash",
        replay: false,
        target_type: "order",
        target_order_id: ORDER,
      },
      error: null,
    });

    const result = await confirmManualOrderPayment({
      orderId: ORDER,
      method: "cash",
      reference: null,
      idempotencyKey: KEY,
    });

    expect(result.confirmationId).toBe(CONFIRM);
    expect(rpc.call).toHaveBeenCalledWith("confirm_manual_order_payment", {
      p_order_id: ORDER,
      p_method: "cash",
      p_reference: "",
      p_idempotency_key: KEY,
    });
    const args = rpc.call.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).not.toHaveProperty("p_amount");
    expect(args).not.toHaveProperty("p_role");
    expect(args).not.toHaveProperty("p_branch_id");
  });

  it("cashier no puede void (forbidden)", async () => {
    session.resolve.mockResolvedValue(staffSession("cashier"));

    await expect(
      voidManualPaymentConfirmation({
        confirmationId: CONFIRM,
        reason: "Error de caja",
        idempotencyKey: KEY,
      }),
    ).rejects.toBeInstanceOf(DiningTablesError);

    await expect(
      voidManualPaymentConfirmation({
        confirmationId: CONFIRM,
        reason: "Error de caja",
        idempotencyKey: KEY,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    expect(rpc.call).not.toHaveBeenCalled();
  });

  it("owner puede void y llega al RPC", async () => {
    session.resolve.mockResolvedValue(staffSession("owner"));
    rpc.call.mockResolvedValue({
      data: {
        void_id: "99999999-9999-4999-8999-999999999999",
        confirmation_id: CONFIRM,
        replay: false,
      },
      error: null,
    });

    const result = await voidManualPaymentConfirmation({
      confirmationId: CONFIRM,
      reason: "Error de caja",
      idempotencyKey: KEY,
    });

    expect(result.voidId).toBe("99999999-9999-4999-8999-999999999999");
    expect(rpc.call).toHaveBeenCalledWith("void_manual_payment_confirmation", {
      p_confirmation_id: CONFIRM,
      p_reason: "Error de caja",
      p_idempotency_key: KEY,
    });
  });
});
