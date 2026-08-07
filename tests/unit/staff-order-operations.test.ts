import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/order";

const session = vi.hoisted(() => ({
  resolve: vi.fn(),
}));
const dataMode = vi.hoisted(() => ({ value: "supabase" as "supabase" | "local" }));
const repo = vi.hoisted(() => ({
  listOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  getOrderById: vi.fn(),
  saveOrder: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getResolvedDataMode: () => dataMode.value,
}));
vi.mock("@/lib/session/server-resolver", () => ({
  resolveServerSession: () => session.resolve(),
}));
vi.mock("@/server/repositories", () => ({
  getOrderRepository: () => repo,
}));

import {
  listOperationalOrders,
  transitionOrderStatus,
} from "@/server/orders/staff-operations";
import { StaffOrderError } from "@/server/orders/staff-errors";
import { mapOrderRowsToOrders, parseModifiersSnapshot } from "@/server/orders/order-mapper";

function sampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    orderNumber: "CB-0001",
    branchId: "branch-centro",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "demo",
    fulfillmentType: "pickup",
    items: [],
    totals: { subtotal: 1000, discount: 0, tax: 80, serviceFee: 0, deliveryFee: 0, tip: 0, total: 1080 },
    currency: "COP",
    customer: { name: "Ana", phone: "300", email: "a@b.co" },
    notes: "",
    createdAt: "2026-08-07T12:00:00.000Z",
    ...overrides,
  };
}

function staffSession(role: string, status: "active" | "suspended" | "inactive" = "active") {
  return {
    kind: role === "owner" || role === "admin" ? role : role,
    profile: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Staff",
      email: "staff@test",
      role,
      status,
      branchIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    },
  };
}

describe("order-mapper snapshots", () => {
  it("mapea modifiers_snapshot históricos sin consultar el menú", () => {
    expect(
      parseModifiersSnapshot([
        { groupId: "g1", groupName: "Extra", optionId: "o1", optionName: "Guac", priceSnapshot: 2000 },
        { broken: true },
      ]),
    ).toEqual([
      { groupId: "g1", groupName: "Extra", optionId: "o1", optionName: "Guac", priceSnapshot: 2000 },
    ]);
  });

  it("mapea pedidos con branch config id por slug", () => {
    const orders = mapOrderRowsToOrders(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          order_number: "CB-9",
          user_id: null,
          branch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          status: "pending",
          payment_status: "pending",
          payment_method: "demo",
          fulfillment_type: "pickup",
          subtotal: 100,
          discount: 0,
          tax: 8,
          service_fee: 0,
          delivery_fee: 0,
          tip: 0,
          total: 108,
          currency: "COP",
          coupon_code: null,
          customer_name: "Ana",
          customer_phone: "300",
          customer_email: "a@b.co",
          address_snapshot: null,
          notes: null,
          created_at: "2026-08-07T12:00:00.000Z",
        },
      ],
      [
        {
          id: "item-1",
          order_id: "11111111-1111-4111-8111-111111111111",
          menu_item_id: "plato-1",
          name_snapshot: "Bandeja",
          unit_price: 100,
          quantity: 1,
          modifiers_snapshot: [],
          notes: null,
          total: 100,
        },
      ],
      new Map([["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "centro"]]),
    );
    expect(orders[0]?.branchId).toBe("branch-centro");
    expect(orders[0]?.items[0]?.nameSnapshot).toBe("Bandeja");
  });
});

describe("staff-operations", () => {
  beforeEach(() => {
    dataMode.value = "supabase";
    session.resolve.mockReset();
    repo.listOrders.mockReset();
    repo.updateOrderStatus.mockReset();
  });

  it("listOperationalOrders usa repository real sin fallback", async () => {
    session.resolve.mockResolvedValue(staffSession("kitchen"));
    repo.listOrders.mockResolvedValue([sampleOrder()]);
    const orders = await listOperationalOrders();
    expect(orders).toHaveLength(1);
    expect(repo.listOrders).toHaveBeenCalledTimes(1);
  });

  it("rechaza DATA_MODE local en operaciones supabase", async () => {
    dataMode.value = "local";
    session.resolve.mockResolvedValue(staffSession("kitchen"));
    await expect(listOperationalOrders()).rejects.toMatchObject({ code: "data-mode" });
  });

  it("deniega staff suspendido e inactivo", async () => {
    session.resolve.mockResolvedValue(staffSession("kitchen", "suspended"));
    await expect(listOperationalOrders()).rejects.toBeInstanceOf(StaffOrderError);
    session.resolve.mockResolvedValue(staffSession("kitchen", "inactive"));
    await expect(listOperationalOrders()).rejects.toMatchObject({ code: "forbidden" });
  });

  it("deniega editor y customer en transiciones", async () => {
    session.resolve.mockResolvedValue(staffSession("editor"));
    await expect(
      transitionOrderStatus({
        orderId: "11111111-1111-4111-8111-111111111111",
        expectedStatus: "pending",
        nextStatus: "confirmed",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    session.resolve.mockResolvedValue({
      kind: "customer_without_membership",
      profile: { id: "c", name: "C", email: "c", role: "customer", status: undefined, branchIds: [] },
    });
    await expect(
      transitionOrderStatus({
        orderId: "11111111-1111-4111-8111-111111111111",
        expectedStatus: "pending",
        nextStatus: "confirmed",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("bloquea delivered en supabase sin tocar DB", async () => {
    session.resolve.mockResolvedValue(staffSession("cashier"));
    await expect(
      transitionOrderStatus({
        orderId: "11111111-1111-4111-8111-111111111111",
        expectedStatus: "ready",
        nextStatus: "delivered",
      }),
    ).rejects.toMatchObject({ code: "delivered-blocked" });
    expect(repo.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("persiste transición válida con expected status", async () => {
    session.resolve.mockResolvedValue(staffSession("cashier"));
    const updated = sampleOrder({ status: "confirmed" });
    repo.updateOrderStatus.mockResolvedValue({ ok: true, order: updated });
    const result = await transitionOrderStatus({
      orderId: updated.id,
      expectedStatus: "pending",
      nextStatus: "confirmed",
    });
    expect(result.status).toBe("confirmed");
    expect(repo.updateOrderStatus).toHaveBeenCalledWith({
      orderId: updated.id,
      expectedStatus: "pending",
      nextStatus: "confirmed",
    });
  });

  it("mapea stale transition y transición inválida", async () => {
    session.resolve.mockResolvedValue(staffSession("kitchen"));
    await expect(
      transitionOrderStatus({
        orderId: "11111111-1111-4111-8111-111111111111",
        expectedStatus: "pending",
        nextStatus: "preparing",
      }),
    ).rejects.toMatchObject({ code: "invalid-transition" });

    session.resolve.mockResolvedValue(staffSession("cashier"));
    repo.updateOrderStatus.mockResolvedValue({ ok: false, reason: "stale" });
    await expect(
      transitionOrderStatus({
        orderId: "11111111-1111-4111-8111-111111111111",
        expectedStatus: "pending",
        nextStatus: "confirmed",
      }),
    ).rejects.toMatchObject({ code: "stale-transition" });
  });

  it("no modifica payment_status desde la acción de estado", async () => {
    session.resolve.mockResolvedValue(staffSession("manager"));
    repo.updateOrderStatus.mockResolvedValue({ ok: true, order: sampleOrder({ status: "confirmed" }) });
    await transitionOrderStatus({
      orderId: "11111111-1111-4111-8111-111111111111",
      expectedStatus: "pending",
      nextStatus: "confirmed",
    });
    const arg = repo.updateOrderStatus.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("paymentStatus");
    expect(Object.keys(arg)).toEqual(["orderId", "expectedStatus", "nextStatus"]);
  });
});
