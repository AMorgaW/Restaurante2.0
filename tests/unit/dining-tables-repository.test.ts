import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  call: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    rpc: (...args: unknown[]) => rpc.call(...args),
  }),
}));

import {
  LocalDiningTablesRepository,
  SupabaseDiningTablesRepository,
} from "@/server/dining-tables/repository";

const BRANCH = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TABLE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER = "11111111-1111-4111-8111-111111111111";
const CONFIRM = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";

describe("SupabaseDiningTablesRepository", () => {
  beforeEach(() => {
    rpc.call.mockReset();
  });

  it("listDiningTables llama list_dining_tables_for_staff con p_include_inactive", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          table_id: TABLE,
          branch_id: BRANCH,
          code: "1",
          name: "Mesa 1",
          is_active: true,
          open_session_id: null,
          session_opened_at: null,
          order_count: 0,
          account_total: 0,
          outstanding_total: 0,
          operational_status: "free",
        },
      ],
      error: null,
    });

    const rows = await new SupabaseDiningTablesRepository().listDiningTables({
      branchId: BRANCH,
      includeInactive: true,
    });

    expect(rpc.call).toHaveBeenCalledWith("list_dining_tables_for_staff", {
      p_branch_id: BRANCH,
      p_include_inactive: true,
    });
    expect(rows[0]?.operationalStatus).toBe("free");
  });

  it("createDiningTable retorna qr_token una vez", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          table_id: TABLE,
          branch_id: BRANCH,
          code: "1",
          qr_token: "a".repeat(64),
        },
      ],
      error: null,
    });

    const cred = await new SupabaseDiningTablesRepository().createDiningTable({
      branchId: BRANCH,
      code: "1",
      name: "Mesa 1",
    });

    expect(rpc.call).toHaveBeenCalledWith("create_dining_table", {
      p_branch_id: BRANCH,
      p_code: "1",
      p_name: "Mesa 1",
    });
    expect(cred.qrToken).toBe("a".repeat(64));
    expect(cred.tableId).toBe(TABLE);
    expect(cred.code).toBe("1");
  });

  it("rotateDiningTableQr llama rotate_dining_table_qr", async () => {
    rpc.call.mockResolvedValue({
      data: [{ table_id: TABLE, qr_token: "b".repeat(64) }],
      error: null,
    });

    const cred = await new SupabaseDiningTablesRepository().rotateDiningTableQr({
      tableId: TABLE,
    });

    expect(rpc.call).toHaveBeenCalledWith("rotate_dining_table_qr", { p_table_id: TABLE });
    expect(cred.qrToken).toBe("b".repeat(64));
  });

  it("resolveTableQr llama resolve_table_qr", async () => {
    rpc.call.mockResolvedValue({
      data: {
        table_id: TABLE,
        branch_id: BRANCH,
        code: "1",
        name: "Mesa 1",
        session_id: SESSION,
        session_status: "open",
      },
      error: null,
    });

    const resolved = await new SupabaseDiningTablesRepository().resolveTableQr({
      qrToken: "c".repeat(64),
    });

    expect(rpc.call).toHaveBeenCalledWith("resolve_table_qr", { p_qr_token: "c".repeat(64) });
    expect(resolved.sessionId).toBe(SESSION);
    expect(resolved.code).toBe("1");
  });

  it("confirmManualOrderPayment envía solo order/method/reference/key (sin amount/role/branch)", async () => {
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

    await new SupabaseDiningTablesRepository().confirmManualOrderPayment({
      orderId: ORDER,
      method: "cash",
      reference: "REF-1",
      idempotencyKey: KEY,
    });

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith("confirm_manual_order_payment", {
      p_order_id: ORDER,
      p_method: "cash",
      p_reference: "REF-1",
      p_idempotency_key: KEY,
    });
    const args = rpc.call.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).not.toHaveProperty("p_amount");
    expect(args).not.toHaveProperty("amount");
    expect(args).not.toHaveProperty("p_role");
    expect(args).not.toHaveProperty("role");
    expect(args).not.toHaveProperty("p_branch_id");
    expect(args).not.toHaveProperty("branch_id");
  });

  it("confirmManualTableSessionPayment misma restricción de args", async () => {
    rpc.call.mockResolvedValue({
      data: {
        confirmation_id: CONFIRM,
        amount: 43000,
        method: "cash",
        replay: false,
        target_type: "table_session",
        target_table_session_id: SESSION,
        session_status: "closed",
      },
      error: null,
    });

    await new SupabaseDiningTablesRepository().confirmManualTableSessionPayment({
      sessionId: SESSION,
      method: "cash",
      reference: null,
      idempotencyKey: KEY,
    });

    expect(rpc.call).toHaveBeenCalledWith("confirm_manual_table_session_payment", {
      p_session_id: SESSION,
      p_method: "cash",
      p_reference: "",
      p_idempotency_key: KEY,
    });
    const args = rpc.call.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual([
      "p_idempotency_key",
      "p_method",
      "p_reference",
      "p_session_id",
    ]);
  });

  it("voidManualPaymentConfirmation llama void_manual_payment_confirmation", async () => {
    rpc.call.mockResolvedValue({
      data: {
        void_id: "99999999-9999-4999-8999-999999999999",
        confirmation_id: CONFIRM,
        replay: false,
      },
      error: null,
    });

    const result = await new SupabaseDiningTablesRepository().voidManualPaymentConfirmation({
      confirmationId: CONFIRM,
      reason: "Error de caja",
      idempotencyKey: KEY,
    });

    expect(rpc.call).toHaveBeenCalledWith("void_manual_payment_confirmation", {
      p_confirmation_id: CONFIRM,
      p_reason: "Error de caja",
      p_idempotency_key: KEY,
    });
    expect(result.voidId).toBe("99999999-9999-4999-8999-999999999999");
  });

  it("getManualPaymentHistory llama get_manual_payment_history", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          confirmation_id: CONFIRM,
          target_type: "table_session",
          target_order_id: null,
          target_table_session_id: SESSION,
          amount: 43000,
          currency: "COP",
          confirmation_kind: "manual",
          method: "cash",
          payment_reference: null,
          confirmed_by: "22222222-2222-4222-8222-222222222222",
          confirmed_by_name: "Cajero",
          confirmed_at: "2026-08-07T13:00:00+00:00",
          status: "active",
          allocations: [],
          void: null,
        },
      ],
      error: null,
    });

    const history = await new SupabaseDiningTablesRepository().getManualPaymentHistory({
      targetType: "table_session",
      targetId: SESSION,
      limit: 10,
    });

    expect(rpc.call).toHaveBeenCalledWith("get_manual_payment_history", {
      p_target_type: "table_session",
      p_target_id: SESSION,
      p_limit: 10,
    });
    expect(history[0]?.amount).toBe(43000);
  });
});

describe("LocalDiningTablesRepository", () => {
  it("lista y crea mesas en aislamiento sin RPC", async () => {
    rpc.call.mockReset();
    const repo = new LocalDiningTablesRepository();
    const before = await repo.listDiningTables({});
    expect(before.length).toBeGreaterThanOrEqual(2);

    const created = await repo.createDiningTable({
      branchId: "branch-centro",
      code: "99",
      name: "Mesa Test",
    });
    expect(created.qrToken).toMatch(/^local-qr-/);
    expect(created.code).toBe("99");

    const after = await repo.listDiningTables({ branchId: "branch-centro" });
    expect(after.some((table) => table.code === "99")).toBe(true);
    expect(rpc.call).not.toHaveBeenCalled();
  });
});
