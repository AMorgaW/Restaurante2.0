/**
 * Integración local: pedidos vía RPC create_customer_order.
 * Requiere Supabase local; no producción; sin service_role en la app.
 */
import { createClient } from "@supabase/supabase-js";
import { getLocalSupabaseServerEnv } from "../helpers/local-supabase-env";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Order } from "@/types/order";

vi.mock("server-only", () => ({}));

const {
  url: LOCAL_URL,
  anonKey: LOCAL_ANON,
  publishableKey: LOCAL_PUBLISHABLE,
  serviceRoleKey: LOCAL_SERVICE,
  testPassword: LOCAL_TEST_PASSWORD,
} = getLocalSupabaseServerEnv();

const RESTAURANT_ID = "21111111-1111-4111-8111-111111111101";
const BRANCH_ID = "21111111-1111-4111-8111-111111111102";
const ITEM_ID = "e11b2b-plato";
const GROUP_ID = "e11b2b-group";
const OPTION_ID = "e11b2b-option";
const INV_ID = "21111111-1111-4111-8111-111111111199";

let authUserId: string | null = null;

function psql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_Restaurante2.0",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  ).trim();
}

function seed() {
  psql(`
    delete from public.inventory_movements where inventory_item_id = '${INV_ID}';
    delete from public.inventory_items where id = '${INV_ID}';
    delete from public.order_items where menu_item_id = '${ITEM_ID}';
    delete from public.orders where branch_id = '${BRANCH_ID}';
    delete from public.modifier_options where id = '${OPTION_ID}';
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = 'e11b2b-cat';
    delete from public.branches where id = '${BRANCH_ID}';
    delete from public.restaurants where id = '${RESTAURANT_ID}';
    delete from public.opening_hours where branch_id in (select id from public.branches where slug = 'centro');
    delete from public.special_hours where branch_id in (select id from public.branches where slug = 'centro');
    delete from public.branch_menu_items where branch_id in (select id from public.branches where slug = 'centro');
    delete from public.branches where slug = 'centro';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'Orders E2E', 'e11b2b-rest', 'active', 0.0800, 0, 20, 'CB');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values ('${BRANCH_ID}', '${RESTAURANT_ID}', 'Centro orders', 'centro', 'active', true, true, 6000, 25000);
    insert into public.opening_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
    select '${BRANCH_ID}'::uuid, day, time '00:00', time '23:59', false
    from generate_series(0, 6) as day;

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', 'e11b2b-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path, is_independently_orderable
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b2b-cat', '${ITEM_ID}', 'Plato 11B2B', 'ok', 20000,
      true, true, 1, '/icon.svg', true
    );

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
    values ('${BRANCH_ID}', '${ITEM_ID}', 22000, true);

    insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
    values ('${GROUP_ID}', '${ITEM_ID}', 'Extra', 1, 1, true, 1);

    insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order)
    values ('${OPTION_ID}', '${GROUP_ID}', 'Guacamole', 2000, true, 1);

    insert into public.inventory_items (
      id, branch_id, name, slug, category, base_unit, display_unit,
      current_quantity, minimum_quantity, cost_per_base_unit
    ) values (
      '${INV_ID}', '${BRANCH_ID}', 'Ing 11B2B', 'e11b2b-ing', 'test', 'g', 'g', 100, 10, 1
    );
  `);
}

function draftOrder(idempotencyKey: string): Order {
  return {
    id: idempotencyKey,
    orderNumber: "TEMP",
    branchId: "branch-centro",
    status: "pending",
    paymentStatus: "pending",
    paymentMethod: "demo",
    fulfillmentType: "pickup",
    items: [
      {
        itemId: ITEM_ID,
        slug: ITEM_ID,
        nameSnapshot: "Plato 11B2B",
        unitPrice: 1,
        quantity: 1,
        modifiers: [
          {
            groupId: GROUP_ID,
            groupName: "Extra",
            optionId: OPTION_ID,
            optionName: "Guacamole",
            priceSnapshot: 999,
          },
        ],
        notes: "",
        total: 1,
      },
    ],
    totals: {
      subtotal: 1,
      discount: 0,
      tax: 0,
      serviceFee: 0,
      deliveryFee: 0,
      tip: 0,
      total: 1,
    },
    currency: "COP",
    customer: { name: "Guest Order", phone: "3001234567", email: "guest-order@test.local" },
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

describe("pedidos Supabase local (RPC)", () => {
  beforeAll(async () => {
    try {
      psql("select 1");
    } catch {
      throw new Error("Supabase local no disponible para integración de pedidos.");
    }

    process.env.DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL_PUBLISHABLE;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON;

    seed();

    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseAnonClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: BRANCH_ID, slug: "centro", status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));

    const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `orders-auth-${Date.now()}@test.local`;
    const password = LOCAL_TEST_PASSWORD;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(`No se pudo crear usuario Auth de prueba: ${created.error?.message}`);
    }
    authUserId = created.data.user.id;
  });

  afterAll(() => {
    try {
      psql(`
        delete from public.inventory_movements where inventory_item_id = '${INV_ID}';
        delete from public.inventory_items where id = '${INV_ID}';
        delete from public.order_items where menu_item_id = '${ITEM_ID}';
        delete from public.orders where branch_id = '${BRANCH_ID}';
        delete from public.modifier_options where id = '${OPTION_ID}';
        delete from public.modifier_groups where id = '${GROUP_ID}';
        delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
        delete from public.menu_items where id = '${ITEM_ID}';
        delete from public.categories where slug = 'e11b2b-cat';
        delete from public.branches where id = '${BRANCH_ID}';
        delete from public.restaurants where id = '${RESTAURANT_ID}';
      `);
      if (authUserId) {
        psql(`delete from auth.users where id = '${authUserId}'`);
      }
    } catch {
      // best-effort
    }
  });

  it("guest: persiste pedido con user_id NULL y total DB", async () => {
    const anon = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseAnonClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: BRANCH_ID, slug: "centro", status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: async () => anon,
    }));
    vi.doMock("@/server/catalog/branch-config", () => ({
      requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
    }));
    const { SupabaseOrderRepository } = await import("@/server/repositories/supabase");
    const key = crypto.randomUUID();
    const saved = await new SupabaseOrderRepository().saveOrder(draftOrder(key), { tipPercent: 0 });

    expect(saved.orderNumber).toMatch(/^CB-[0-9]{7}$/);
    expect(saved.status).toBe("pending");
    expect(saved.paymentStatus).toBe("pending");
    expect(saved.totals.total).toBe(25920);
    expect(saved.id).not.toBe(key);

    const userId = psql(`select coalesce(user_id::text, '') from public.orders where id = '${saved.id}'`);
    expect(userId).toBe("");

    const stock = Number(
      psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`),
    );
    expect(stock).toBe(100);
    const movements = psql(
      `select count(*)::text from public.inventory_movements where order_id = '${saved.id}'`,
    );
    expect(movements).toBe("0");

    const mods = psql(
      `select modifiers_snapshot::text from public.order_items where order_id = '${saved.id}' limit 1`,
    );
    expect(mods).toContain(OPTION_ID);
  });

  it("retry misma key → replay mismo pedido", async () => {
    const anon = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseAnonClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: BRANCH_ID, slug: "centro", status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: async () => anon,
    }));
    vi.doMock("@/server/catalog/branch-config", () => ({
      requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
    }));
    const { SupabaseOrderRepository } = await import("@/server/repositories/supabase");
    const key = crypto.randomUUID();
    const first = await new SupabaseOrderRepository().saveOrder(draftOrder(key), { tipPercent: 0 });
    const second = await new SupabaseOrderRepository().saveOrder(draftOrder(key), { tipPercent: 0 });
    expect(second.id).toBe(first.id);
    expect(second.replay).toBe(true);
    expect(second.orderNumber).toBe(first.orderNumber);
    const count = psql(`select count(*)::text from public.orders where idempotency_key = '${key}'`);
    expect(count).toBe("1");
  });

  it("misma key + intención distinta → conflicto", async () => {
    const anon = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseAnonClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: BRANCH_ID, slug: "centro", status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: async () => anon,
    }));
    vi.doMock("@/server/catalog/branch-config", () => ({
      requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
    }));
    const { SupabaseOrderRepository } = await import("@/server/repositories/supabase");
    const key = crypto.randomUUID();
    await new SupabaseOrderRepository().saveOrder(draftOrder(key), { tipPercent: 0 });
    const other = draftOrder(key);
    other.items = [
      {
        ...other.items[0]!,
        quantity: 2,
      },
    ];
    await expect(new SupabaseOrderRepository().saveOrder(other, { tipPercent: 0 })).rejects.toMatchObject({
      code: "idempotency-conflict",
    });
  });

  it("authenticated: order.user_id = auth.uid()", async () => {
    if (!authUserId) throw new Error("usuario Auth de prueba ausente");
    const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = (await admin.auth.admin.getUserById(authUserId)).data.user?.email;
    if (!email) throw new Error("email Auth ausente");
    await admin.auth.admin.updateUserById(authUserId, { password: LOCAL_TEST_PASSWORD });
    const userClient = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await userClient.auth.signInWithPassword({
      email,
      password: LOCAL_TEST_PASSWORD,
    });
    if (signed.error) throw new Error(signed.error.message);

    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseAnonClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: BRANCH_ID, slug: "centro", status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: async () => userClient,
    }));
    vi.doMock("@/server/catalog/branch-config", () => ({
      requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
    }));
    const { SupabaseOrderRepository } = await import("@/server/repositories/supabase");
    const saved = await new SupabaseOrderRepository().saveOrder(draftOrder(crypto.randomUUID()), {
      tipPercent: 0,
    });
    const bound = psql(`select user_id::text from public.orders where id = '${saved.id}'`);
    expect(bound).toBe(authUserId);
  });

  it("precio manipulado en Node no es autoridad", async () => {
    const anon = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getSupabaseAnonClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: BRANCH_ID, slug: "centro", status: "active" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: async () => anon,
    }));
    vi.doMock("@/server/catalog/branch-config", () => ({
      requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
    }));
    const { SupabaseOrderRepository } = await import("@/server/repositories/supabase");
    const crafted = draftOrder(crypto.randomUUID());
    crafted.totals.total = 1;
    crafted.items[0]!.unitPrice = 1;
    const saved = await new SupabaseOrderRepository().saveOrder(crafted, { tipPercent: 0 });
    expect(saved.totals.total).toBe(25920);
    const dbTotal = psql(`select total::text from public.orders where id = '${saved.id}'`);
    expect(dbTotal).toBe("25920");
  });
});
