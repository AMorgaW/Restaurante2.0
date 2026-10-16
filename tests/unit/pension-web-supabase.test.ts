/**
 * Unit tests 11B-5: capa web pensionado → Supabase (mapper, errors, load, repository args).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const dataMode = vi.hoisted(() => ({ value: "local" as "local" | "supabase" }));
const rpc = vi.hoisted(() => ({ call: vi.fn() }));
const loadSnapshots = vi.hoisted(() => ({
  customer: vi.fn(),
  admin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getResolvedDataMode: () => dataMode.value,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    rpc: (...args: unknown[]) => rpc.call(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", slug: "centro", status: "active" },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/server/pension/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/pension/service")>();
  return {
    ...actual,
    loadCustomerPensionSnapshot: (...args: unknown[]) => loadSnapshots.customer(...args),
    loadAdminPensionSnapshot: (...args: unknown[]) => loadSnapshots.admin(...args),
  };
});

import { adminRoleCan } from "@/lib/admin/authorization";
import { mapPensionRpcError, PensionPersistenceError } from "@/server/pension/errors";
import {
  mapPensionMembershipRow,
  previewCalendarEndsAt,
  type PensionMembershipRow,
} from "@/server/pension/mapper";
import { createPensionOrderSchema } from "@/server/pension/schemas";
import { SupabasePensionRepository } from "@/server/pension/repository";
import {
  loadAdminPensionForUi,
  loadCustomerPensionForUi,
} from "@/server/pension/load";
import { LocalOrderRepository } from "@/server/repositories/local";
import { getOrderRepository } from "@/server/repositories";
import { SupabaseOrderRepository } from "@/server/repositories/supabase";

const SAMPLE_MEMBERSHIP_ROW: PensionMembershipRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  profile_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  plan_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  branch_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  status: "active",
  modality: "calendar_period",
  public_price_snapshot: 300000,
  agreed_price: 240000,
  payment_method: "cash",
  payment_date: "2026-08-07",
  starts_at: "2026-08-07",
  ends_at: "2026-09-05",
  meal_limit: null,
  meals_consumed: 0,
  activated_at: "2026-08-07T12:00:00+00:00",
};

describe("mapPensionRpcError", () => {
  it("mapea membership sin filtrar SQL", () => {
    const mapped = mapPensionRpcError({
      message: "No hay membresia activa para el cliente",
      details: "HINT: check search_path fingerprint=deadbeef",
      hint: "internal key=sk_live",
    });
    expect(mapped).toBeInstanceOf(PensionPersistenceError);
    expect(mapped.code).toBe("membership");
    expect(mapped.message).toMatch(/membresía pensionada válida/i);
    expect(mapped.message).not.toMatch(/HINT|fingerprint|search_path|sk_live|pg_/i);
  });

  it("mapea already-consumed por mensaje y por 23505", () => {
    const byMessage = mapPensionRpcError({
      message: "ya consumiste este menu once_per_menu",
    });
    expect(byMessage.code).toBe("already-consumed");

    const byCode = mapPensionRpcError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
      details: "Key (membership_id, menu_id) already exists on pension_consumptions",
    });
    expect(byCode.code).toBe("already-consumed");
    expect(byCode.message).not.toMatch(/duplicate key|constraint|membership_id/i);
  });

  it("mapea delivery-fee-missing, forbidden e idempotency-conflict", () => {
    expect(
      mapPensionRpcError({ message: "Fee de domicilio pensionado no configurado" }).code,
    ).toBe("delivery-fee-missing");

    const forbidden = mapPensionRpcError({
      code: "42501",
      message: "permission denied for function create_pension_order",
    });
    expect(forbidden.code).toBe("forbidden");
    expect(forbidden.httpStatus).toBe(403);
    expect(forbidden.message).not.toMatch(/permission denied|create_pension_order/i);

    const conflict = mapPensionRpcError({ message: "Conflicto de idempotencia" });
    expect(conflict.code).toBe("idempotency-conflict");
    expect(conflict.httpStatus).toBe(409);
  });

  it("mapea únicamente el P0001 exacto de compuerta cerrada", () => {
    const closed = mapPensionRpcError({
      code: "P0001",
      message: "La recepción de pedidos no está disponible",
      details: "sin detalles públicos",
    });
    expect(closed.code).toBe("public-order-intake-closed");
    expect(closed.httpStatus).toBe(503);
    expect(closed.message).toBe("La recepción de pedidos no está disponible temporalmente.");

    const otherP0001 = mapPensionRpcError({ code: "P0001", message: "Otra regla comercial" });
    expect(otherP0001.code).toBe("persistence-error");
    expect(otherP0001.httpStatus).toBe(503);
  });

  it("nunca filtra SQL/hint/key en errores genéricos", () => {
    const mapped = mapPensionRpcError({
      message: "relation pg_temp._pension_lines does not exist",
      details: "HINT: check search_path fingerprint=abc123 key=secret",
      hint: "internal",
    });
    expect(mapped.code).toBe("persistence-error");
    expect(mapped.message).not.toMatch(/pg_temp|fingerprint|HINT|search_path|secret|key=/i);
  });
});

describe("previewCalendarEndsAt / mapper", () => {
  it("calcula starts_at + 29 días inclusivo (vista previa)", () => {
    expect(previewCalendarEndsAt("2026-08-07")).toBe("2026-09-05");
    expect(previewCalendarEndsAt("2026-03-01")).toBe("2026-03-30");
    expect(previewCalendarEndsAt("2024-02-01")).toBe("2024-03-01");
  });

  it("mapPensionMembershipRow proyecta status y precios", () => {
    const mapped = mapPensionMembershipRow(SAMPLE_MEMBERSHIP_ROW, {
      profileName: "Ana",
      profileEmail: "ana@test.local",
      planName: "Calendario 30",
    });
    expect(mapped.status).toBe("active");
    expect(mapped.publicPrice).toBe(300000);
    expect(mapped.agreedPrice).toBe(240000);
    expect(mapped.startsAt).toBe("2026-08-07");
    expect(mapped.endsAt).toBe("2026-09-05");
    expect(mapped.planName).toBe("Calendario 30");

    const unknown = mapPensionMembershipRow({
      ...SAMPLE_MEMBERSHIP_ROW,
      status: "weird",
      agreed_price: null,
      payment_method: null,
    });
    expect(unknown.status).toBe("pending");
    expect(unknown.agreedPrice).toBeUndefined();
  });
});

describe("loadCustomerPensionForUi / loadAdminPensionForUi", () => {
  beforeEach(() => {
    dataMode.value = "local";
    loadSnapshots.customer.mockReset();
    loadSnapshots.admin.mockReset();
  });

  it("DATA_MODE local: retorna mode local sin fixture", async () => {
    const customer = await loadCustomerPensionForUi("user-1");
    expect(customer.mode).toBe("local");
    expect(customer.snapshot.membership).toBeNull();
    expect(customer.snapshot.plans).toEqual([]);
    expect(customer.error).toMatch(/DATA_MODE=supabase/i);
    expect(loadSnapshots.customer).not.toHaveBeenCalled();

    const admin = await loadAdminPensionForUi();
    expect(admin.mode).toBe("local");
    expect(admin.snapshot.memberships).toEqual([]);
    expect(admin.error).toMatch(/DATA_MODE=supabase/i);
    expect(loadSnapshots.admin).not.toHaveBeenCalled();
  });

  it("DATA_MODE supabase: sin fallback a fixture ante error (snapshot vacío)", async () => {
    dataMode.value = "supabase";
    loadSnapshots.customer.mockRejectedValue(new Error("db down"));
    loadSnapshots.admin.mockRejectedValue(new Error("db down"));

    const customer = await loadCustomerPensionForUi("user-1");
    expect(customer.mode).toBe("supabase");
    expect(customer.error).toMatch(/No se pudo cargar/i);
    expect(customer.snapshot).toEqual({
      membership: null,
      plans: [],
      menusByDate: {},
      deliveryFee: null,
      consumptions: [],
      branchId: null,
      branchSlug: null,
      commercialDate: null,
    });

    const admin = await loadAdminPensionForUi();
    expect(admin.mode).toBe("supabase");
    expect(admin.error).toMatch(/No se pudo cargar/i);
    expect(admin.snapshot).toEqual({
      memberships: [],
      plans: [],
      menus: [],
      branches: [],
      catalogMenuItems: [],
    });
  });
});

describe("createPensionOrder repository", () => {
  const orderInput = {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    menuId: "22222222-2222-4222-8222-222222222222",
    pensionMenuItemIds: ["33333333-3333-4333-8333-333333333333"],
    fulfillmentType: "pickup" as const,
    customerName: "Ana Pérez",
    customerPhone: "3001234567",
    customerEmail: "ana@example.com",
  };

  beforeEach(() => {
    rpc.call.mockReset();
  });

  it("schema acepta ids/fulfillment/contacto/idempotency y no precios autoritativos", () => {
    const parsed = createPensionOrderSchema.safeParse(orderInput);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("surcharge");
    expect(parsed.data).not.toHaveProperty("price");
    expect(parsed.data).not.toHaveProperty("total");
    expect(parsed.data).not.toHaveProperty("delivery_fee");
    expect(parsed.data).not.toHaveProperty("deliveryFee");
  });

  it("RPC args no incluyen surcharge/price/total/delivery_fee como autoridad", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          order_id: "44444444-4444-4444-8444-444444444444",
          order_number: "PN-0000001",
          status: "pending",
          total: 0,
          created_at: "2026-08-07T12:00:00+00:00",
          consumption_id: "55555555-5555-4555-8555-555555555555",
          replay: false,
        },
      ],
      error: null,
    });

    const result = await new SupabasePensionRepository().createPensionOrder(orderInput);

    expect(rpc.call).toHaveBeenCalledTimes(1);
    expect(rpc.call).toHaveBeenCalledWith(
      "create_pension_order",
      expect.objectContaining({
        p_idempotency_key: orderInput.idempotencyKey,
        p_menu_id: orderInput.menuId,
        p_pension_menu_item_ids: orderInput.pensionMenuItemIds,
        p_fulfillment_type: "pickup",
        p_customer_name: "Ana Pérez",
        p_customer_phone: "3001234567",
        p_customer_email: "ana@example.com",
      }),
    );
    const args = rpc.call.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args).not.toHaveProperty("p_surcharge");
    expect(args).not.toHaveProperty("p_price");
    expect(args).not.toHaveProperty("p_total");
    expect(args).not.toHaveProperty("p_unit_price");
    expect(args).not.toHaveProperty("p_delivery_fee");
    expect(args).not.toHaveProperty("surcharge");
    expect(args).not.toHaveProperty("total");
    expect(args).not.toHaveProperty("delivery_fee");

    expect(result.paymentStatus).toBe("pending");
    expect(result.replay).toBe(false);
    expect(result.total).toBe(0);
  });

  it("paymentStatus siempre pending y replay true es éxito", async () => {
    rpc.call.mockResolvedValue({
      data: [
        {
          order_id: "66666666-6666-4666-8666-666666666666",
          order_number: "PN-0000002",
          status: "confirmed",
          total: 6240,
          created_at: "2026-08-07T12:00:00+00:00",
          consumption_id: "77777777-7777-4777-8777-777777777777",
          replay: true,
        },
      ],
      error: null,
    });

    const result = await new SupabasePensionRepository().createPensionOrder(orderInput);
    expect(result.replay).toBe(true);
    expect(result.paymentStatus).toBe("pending");
    expect(result.orderId).toBe("66666666-6666-4666-8666-666666666666");
    expect(result.consumptionId).toBe("77777777-7777-4777-8777-777777777777");
  });
});

describe("adminRoleCan manage-pension-memberships", () => {
  it("solo owner y admin pueden gestionar membresías", () => {
    expect(adminRoleCan("owner", "manage-pension-memberships")).toBe(true);
    expect(adminRoleCan("admin", "manage-pension-memberships")).toBe(true);
    for (const role of ["manager", "editor", "kitchen", "cashier", "support"] as const) {
      expect(adminRoleCan(role, "manage-pension-memberships")).toBe(false);
    }
    expect(adminRoleCan(null, "manage-pension-memberships")).toBe(false);
    expect(adminRoleCan("customer" as never, "manage-pension-memberships")).toBe(false);
  });
});

describe("getOrderRepository / LocalOrderRepository (ruta standard)", () => {
  it("DATA_MODE local sigue en LocalOrderRepository; supabase en SupabaseOrderRepository", () => {
    dataMode.value = "local";
    expect(getOrderRepository()).toBeInstanceOf(LocalOrderRepository);
    dataMode.value = "supabase";
    expect(getOrderRepository()).toBeInstanceOf(SupabaseOrderRepository);
  });
});
