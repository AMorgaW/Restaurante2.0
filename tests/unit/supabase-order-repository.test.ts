import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/order";

const rpc = vi.hoisted(() => ({
  call: vi.fn(),
  resolveBranch: vi.fn(async () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    rpc: (...args: unknown[]) => rpc.call(...args),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAnonClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                slug: "centro",
                status: "active",
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/server/catalog/branch-config", () => ({
  requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
}));

import { SupabaseOrderRepository } from "@/server/repositories/supabase";
import { OrderPersistenceError } from "@/server/orders/rpc-errors";
import { LocalOrderRepository } from "@/server/repositories/local";

function sampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    orderNumber: "CB-LOCAL01",
    branchId: "branch-centro",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "demo",
    fulfillmentType: "pickup",
    items: [
      {
        itemId: "plato-1",
        slug: "plato-1",
        nameSnapshot: "Plato",
        unitPrice: 20000,
        quantity: 1,
        modifiers: [
          {
            groupId: "g1",
            groupName: "Extra",
            optionId: "o1",
            optionName: "Guac",
            priceSnapshot: 2000,
          },
        ],
        notes: "sin cebolla",
        total: 22000,
      },
    ],
    totals: {
      subtotal: 22000,
      discount: 0,
      tax: 1760,
      serviceFee: 0,
      deliveryFee: 0,
      tip: 0,
      total: 23760,
    },
    currency: "COP",
    customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
    notes: "nota",
    createdAt: "2026-08-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("SupabaseOrderRepository create_customer_order", () => {
  beforeEach(() => {
    rpc.call.mockReset();
  });

  it("llama una sola RPC sin user_id/precios/status autoritativos", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          order_id: "11111111-1111-4111-8111-111111111111",
          order_number: "CB-0000001",
          status: "pending",
          total: 25920,
          created_at: "2026-08-07T12:00:00+00:00",
          replay: false,
        },
      ],
      error: null,
    });

    const repo = new SupabaseOrderRepository();
    const draft = sampleOrder();
    const saved = await repo.saveOrder(draft, { tipPercent: 0 });

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith(
      "create_customer_order",
      expect.objectContaining({
        p_idempotency_key: draft.id,
        p_branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        p_fulfillment_type: "pickup",
        p_customer_name: "Ana Pérez",
        p_tip_percent: 0,
        p_items: [
          {
            menu_item_id: "plato-1",
            quantity: 1,
            notes: "sin cebolla",
            modifier_option_ids: ["o1"],
          },
        ],
      }),
    );
    const args = rpc.call.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).not.toHaveProperty("p_user_id");
    expect(args).not.toHaveProperty("user_id");
    expect(args).not.toHaveProperty("p_total");
    expect(args).not.toHaveProperty("p_status");
    expect(args).not.toHaveProperty("p_unit_price");

    expect(saved.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(saved.orderNumber).toBe("CB-0000001");
    expect(saved.status).toBe("pending");
    expect(saved.paymentStatus).toBe("pending");
    expect(saved.paymentMethod).toBe("demo");
    expect(saved.totals.total).toBe(25920);
    expect(saved.replay).toBe(false);
  });

  it("acepta replay como éxito con el pedido original", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          order_id: "22222222-2222-4222-8222-222222222222",
          order_number: "CB-0000002",
          status: "pending",
          total: 10000,
          created_at: "2026-08-07T12:00:00+00:00",
          replay: true,
        },
      ],
      error: null,
    });

    const saved = await new SupabaseOrderRepository().saveOrder(sampleOrder());
    expect(saved.replay).toBe(true);
    expect(saved.id).toBe("22222222-2222-4222-8222-222222222222");
    expect(saved.totals.total).toBe(10000);
  });

  it("usa el wrapper C2.2 cuando recibe una credencial, sin fallback", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          order_id: "22222222-2222-4222-8222-222222222222",
          order_number: "CB-0000002",
          status: "pending",
          total: 10000,
          created_at: "2026-08-07T12:00:00+00:00",
          replay: false,
        },
      ],
      error: null,
    });
    const receiptKey = "A".repeat(43);
    await new SupabaseOrderRepository().saveOrder(sampleOrder(), { receiptKey });
    expect(rpc.call).toHaveBeenCalledWith(
      "create_customer_order_with_receipt",
      expect.objectContaining({
        p_receipt_key: receiptKey,
        p_idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        p_branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        p_fulfillment_type: "pickup",
        p_customer_name: "Ana Pérez",
        p_customer_phone: "3001234567",
        p_customer_email: "ana@example.com",
        p_items: [
          { menu_item_id: "plato-1", quantity: 1, notes: "sin cebolla", modifier_option_ids: ["o1"] },
        ],
        p_address: null,
        p_notes: "nota",
        p_tip_percent: 0,
        p_coupon_code: null,
      }),
    );
  });

  it("mapea conflicto de idempotencia de forma segura", async () => {
    rpc.call.mockResolvedValue({
      data: null,
      error: { message: "Conflicto de idempotencia", code: "23505" },
    });

    await expect(new SupabaseOrderRepository().saveOrder(sampleOrder())).rejects.toMatchObject({
      name: "OrderPersistenceError",
      code: "idempotency-conflict",
    });
  });

  it("no filtra SQL/internals en errores genéricos", async () => {
    rpc.call.mockResolvedValue({
      data: null,
      error: {
        message: "relation pg_temp._order_lines does not exist",
        details: "HINT: check search_path fingerprint=deadbeef",
        hint: "internal",
      },
    });

    try {
      await new SupabaseOrderRepository().saveOrder(sampleOrder());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(OrderPersistenceError);
      const mapped = error as OrderPersistenceError;
      expect(mapped.message).not.toMatch(/pg_temp|fingerprint|HINT|search_path/i);
      expect(mapped.code).toBe("persistence-error");
    }
  });
});

describe("LocalOrderRepository", () => {
  it("no llama RPC y conserva el pedido demo", async () => {
    const order = sampleOrder({ status: "confirmed", paymentStatus: "paid" });
    const saved = await new LocalOrderRepository().saveOrder(order);
    expect(saved).toEqual(order);
    expect(rpc.call).not.toHaveBeenCalled();
  });
});
