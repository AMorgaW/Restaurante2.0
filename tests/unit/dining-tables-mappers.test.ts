import { describe, expect, it } from "vitest";
import {
  mapDiningTableList,
  mapManualPaymentHistory,
  mapResolvedTableQr,
  mapTableSessionAccount,
} from "@/server/dining-tables/mappers";

describe("mapDiningTableList (0014 shape)", () => {
  it("mapea operational_status y totales snake_case", () => {
    const mapped = mapDiningTableList([
      {
        table_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        code: "1",
        name: "Mesa 1",
        is_active: true,
        open_session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        session_opened_at: "2026-08-07T12:00:00+00:00",
        order_count: 2,
        account_total: 43000,
        outstanding_total: 43000,
        operational_status: "open_account",
      },
      {
        table_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        code: "2",
        name: null,
        is_active: true,
        open_session_id: null,
        session_opened_at: null,
        order_count: 0,
        account_total: 0,
        outstanding_total: 0,
        operational_status: "free",
      },
      { broken: true },
    ]);

    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toMatchObject({
      tableId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "1",
      name: "Mesa 1",
      orderCount: 2,
      accountTotal: 43000,
      outstandingTotal: 43000,
      operationalStatus: "open_account",
      openSessionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    expect(mapped[1]?.operationalStatus).toBe("free");
  });

  it("devuelve [] si el payload no es array", () => {
    expect(mapDiningTableList(null)).toEqual([]);
    expect(mapDiningTableList({ table_id: "x" })).toEqual([]);
  });
});

describe("mapTableSessionAccount (0014 shape)", () => {
  it("mapea session, orders y summary", () => {
    const mapped = mapTableSessionAccount({
      session: {
        session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        table_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        table_code: "1",
        table_name: "Mesa 1",
        branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "open",
        opened_at: "2026-08-07T12:00:00+00:00",
        closed_at: null,
        opened_by: null,
        closed_by: null,
      },
      orders: [
        {
          order_id: "11111111-1111-4111-8111-111111111111",
          order_number: "CB-0001",
          status: "preparing",
          payment_status: "pending",
          payment_method: null,
          payment_reference: null,
          total: 25000,
          created_at: "2026-08-07T12:05:00+00:00",
          order_kind: "standard",
          fulfillment_type: "local",
          active_manual_payment_confirmation_id: null,
        },
      ],
      summary: {
        order_count: 1,
        account_total: 25000,
        outstanding_total: 25000,
        paid_count: 0,
        pending_count: 1,
      },
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.session.tableCode).toBe("1");
    expect(mapped?.session.status).toBe("open");
    expect(mapped?.summary).toEqual({
      orderCount: 1,
      accountTotal: 25000,
      outstandingTotal: 25000,
      paidCount: 0,
      pendingCount: 1,
    });
    expect(mapped?.orders[0]).toMatchObject({
      orderNumber: "CB-0001",
      paymentStatus: "pending",
      total: 25000,
      fulfillmentType: "local",
    });
  });
});

describe("mapManualPaymentHistory (0014 shape)", () => {
  it("mapea void anidado y allocations", () => {
    const mapped = mapManualPaymentHistory([
      {
        confirmation_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        target_type: "table_session",
        target_order_id: null,
        target_table_session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        amount: 43000,
        currency: "COP",
        confirmation_kind: "manual",
        method: "cash",
        payment_reference: null,
        confirmed_by: "22222222-2222-4222-8222-222222222222",
        confirmed_by_name: "Cajero",
        confirmed_at: "2026-08-07T13:00:00+00:00",
        status: "voided",
        allocations: [
          {
            allocation_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            order_id: "11111111-1111-4111-8111-111111111111",
            order_number: "CB-0001",
            allocated_amount: 25000,
            previous_payment_status: "pending",
          },
        ],
        void: {
          void_id: "99999999-9999-4999-8999-999999999999",
          voided_by: "33333333-3333-4333-8333-333333333333",
          voided_by_name: "Owner",
          voided_at: "2026-08-07T14:00:00+00:00",
          reason: "Error de caja",
        },
      },
    ]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.status).toBe("voided");
    expect(mapped[0]?.confirmationKind).toBe("cash");
    expect(mapped[0]?.amount).toBe(43000);
    expect(mapped[0]?.allocations[0]?.allocatedAmount).toBe(25000);
    expect(mapped[0]?.void).toEqual({
      voidId: "99999999-9999-4999-8999-999999999999",
      voidedBy: "33333333-3333-4333-8333-333333333333",
      voidedByName: "Owner",
      voidedAt: "2026-08-07T14:00:00+00:00",
      reason: "Error de caja",
    });
  });

  it("deja void null cuando no hay anulación", () => {
    const mapped = mapManualPaymentHistory([
      {
        confirmation_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        target_type: "order",
        target_order_id: "11111111-1111-4111-8111-111111111111",
        target_table_session_id: null,
        amount: 10000,
        currency: "COP",
        confirmation_kind: "manual",
        method: "bank_transfer",
        payment_reference: "REF-1",
        confirmed_by: "22222222-2222-4222-8222-222222222222",
        confirmed_by_name: null,
        confirmed_at: "2026-08-07T13:00:00+00:00",
        status: "active",
        allocations: [],
        void: null,
      },
    ]);
    expect(mapped[0]?.void).toBeNull();
    expect(mapped[0]?.status).toBe("active");
  });
});

describe("mapResolvedTableQr", () => {
  it("mapea respuesta pública de resolve_table_qr", () => {
    const mapped = mapResolvedTableQr({
      table_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      code: "1",
      name: "Mesa 1",
      session_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      session_status: "open",
    });
    expect(mapped).toEqual({
      code: "1",
      name: "Mesa 1",
      branchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tableId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sessionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      sessionStatus: "open",
    });
  });

  it("rechaza payload incompleto", () => {
    expect(mapResolvedTableQr({ code: "1" })).toBeNull();
  });
});
