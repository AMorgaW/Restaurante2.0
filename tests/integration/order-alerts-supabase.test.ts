/**
 * Integración 11B-7: detección lógica de pedidos nuevos + aislamiento branch vía RLS.
 * Sin service_role en el camino de lectura staff; fixtures Auth solo para armar roles.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalSupabaseServerEnv } from "../helpers/local-supabase-env";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  countPendingAttention,
  tickOperationalOrderMonitor,
  type OperationalOrderSnapshot,
} from "@/lib/orders/operational-order-monitor";

vi.mock("server-only", () => ({}));

const {
  url: LOCAL_URL,
  anonKey: LOCAL_ANON,
  serviceRoleKey: LOCAL_SERVICE,
  testPassword: LOCAL_TEST_PASSWORD,
} = getLocalSupabaseServerEnv();

const RESTAURANT_ID = "51111111-1111-4111-8111-111111111101";
const BRANCH_A = "51111111-1111-4111-8111-111111111102";
const BRANCH_B = "51111111-1111-4111-8111-111111111103";
const ITEM_ID = "e11b7-plato";
const GROUP_ID = "e11b7-group";
const OPTION_ID = "e11b7-option";

const passwords = LOCAL_TEST_PASSWORD;
const staff = {
  owner: { id: "", email: "", role: "owner", branchId: null as string | null },
  cashierA: { id: "", email: "", role: "cashier", branchId: BRANCH_A },
  cashierB: { id: "", email: "", role: "cashier", branchId: BRANCH_B },
  managerA: { id: "", email: "", role: "manager", branchId: BRANCH_A },
};

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

function seedCatalog() {
  psql(`
    set session_replication_role = replica;
    delete from public.order_items where menu_item_id = '${ITEM_ID}';
    delete from public.orders where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    set session_replication_role = DEFAULT;
    delete from public.modifier_options where id = '${OPTION_ID}';
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = 'e11b7-cat';
    delete from public.staff_branch_permissions where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.opening_hours where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.branches where id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'Alerts 11B7', 'e11b7-rest', 'active', 0.0800, 0, 20, 'AL');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values
      ('${BRANCH_A}', '${RESTAURANT_ID}', 'Centro 11B7', 'centro-11b7', 'active', true, true, 6000, 20000),
      ('${BRANCH_B}', '${RESTAURANT_ID}', 'Norte 11B7', 'norte-11b7', 'active', true, false, 0, 0);

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', 'e11b7-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b7-cat', '${ITEM_ID}', 'Plato 11B7', 'ok', 20000,
      true, true, 1, '/icon.svg'
    );

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
    values ('${BRANCH_A}', '${ITEM_ID}', 22000, true), ('${BRANCH_B}', '${ITEM_ID}', 22000, true);

    insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
    values ('${GROUP_ID}', '${ITEM_ID}', 'Extra', 1, 1, true, 1);

    insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order)
    values ('${OPTION_ID}', '${GROUP_ID}', 'Guacamole', 2000, true, 1);

    insert into public.opening_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
    select b.id, d.day, '00:00'::time, '23:59'::time, false
    from public.branches b
    cross join generate_series(0, 6) as d(day)
    where b.id in ('${BRANCH_A}', '${BRANCH_B}');
  `);
}

async function createAuthUser(
  admin: SupabaseClient,
  key: string,
  role: string,
  branchId: string | null,
) {
  const email = `11b7-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({
    email,
    password: passwords,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`No se pudo crear ${key}: ${created.error?.message}`);
  }
  const id = created.data.user.id;
  if (role === "owner") {
    psql(`update public.profiles set role = 'owner', staff_status = 'active' where id = '${id}'`);
  } else {
    psql(`
      update public.profiles set role = '${role}', staff_status = 'active' where id = '${id}';
      ${branchId ? `insert into public.staff_branch_permissions (profile_id, branch_id) values ('${id}', '${branchId}') on conflict do nothing;` : ""}
    `);
  }
  return { id, email };
}

async function clientAs(email: string) {
  const result = await createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email, password: passwords });
  if (result.error || !result.data.session) throw new Error(result.error?.message ?? "login failed");
  return createClient(LOCAL_URL, LOCAL_ANON, {
    global: { headers: { Authorization: `Bearer ${result.data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createOrder(
  branchId: string,
  key: string,
  fulfillment: "pickup" | "delivery" = "pickup",
): Promise<{ orderId: string; replay: boolean; orderNumber: string }> {
  const anon = createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const payload: Record<string, unknown> = {
    p_idempotency_key: key,
    p_branch_id: branchId,
    p_fulfillment_type: fulfillment,
    p_customer_name: "Guest 11B7",
    p_customer_phone: "3001234567",
    p_customer_email: "guest11b7@test.local",
    p_items: [{ menu_item_id: ITEM_ID, quantity: 1, notes: "", modifier_option_ids: [OPTION_ID] }],
    p_address:
      fulfillment === "delivery"
        ? { street: "Calle 1", details: "Apto", neighborhood: "Centro" }
        : null,
    p_notes: null,
    p_tip_percent: 0,
    p_coupon_code: null,
  };
  const { data, error } = await anon.rpc("create_customer_order", payload);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const typed = row as { order_id: string; replay: boolean; order_number: string };
  return { orderId: typed.order_id, replay: typed.replay, orderNumber: typed.order_number };
}

async function listSnapshots(email: string): Promise<OperationalOrderSnapshot[]> {
  const client = await clientAs(email);
  const { data, error } = await client
    .from("orders")
    .select("id, order_number, status, fulfillment_type, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    orderNumber: row.order_number as string,
    status: row.status as OperationalOrderSnapshot["status"],
    fulfillmentType: row.fulfillment_type as OperationalOrderSnapshot["fulfillmentType"],
    createdAt: row.created_at as string,
  }));
}

describe("11B-7 avisos operativos (Supabase local)", () => {
  beforeAll(async () => {
    try {
      psql("select 1");
    } catch {
      throw new Error("Supabase local no disponible para integración 11B-7.");
    }
    seedCatalog();
    const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const [key, fixture] of Object.entries(staff)) {
      const created = await createAuthUser(admin, key, fixture.role, fixture.branchId);
      fixture.id = created.id;
      fixture.email = created.email;
    }
  }, 120_000);

  afterAll(() => {
    try {
      const ids = Object.values(staff)
        .map((s) => s.id)
        .filter(Boolean)
        .map((id) => `'${id}'`)
        .join(",");
      if (ids) {
        psql(`
          delete from public.staff_branch_permissions where profile_id in (${ids});
          delete from public.profiles where id in (${ids});
          delete from auth.users where id in (${ids});
        `);
      }
      seedCatalog();
    } catch {
      // best-effort
    }
  });

  it("A–D: baseline + guest order + un aviso + replay sin segundo evento", async () => {
    const before = await listSnapshots(staff.cashierA.email);
    const baseline = tickOperationalOrderMonitor({
      orders: before,
      observedIds: new Set(),
      baselineDone: false,
      emitPendingAlerts: true,
    });
    expect(baseline.shouldToast).toBe(false);

    const key = crypto.randomUUID();
    const created = await createOrder(BRANCH_A, key, "pickup");
    expect(created.replay).toBe(false);

    const after = await listSnapshots(staff.cashierA.email);
    const tick = tickOperationalOrderMonitor(
      {
        orders: after,
        observedIds: baseline.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      baseline.fingerprint,
    );
    expect(tick.newOrders.map((o) => o.id)).toEqual([created.orderId]);
    expect(tick.shouldToast).toBe(true);

    const replayed = await createOrder(BRANCH_A, key, "pickup");
    expect(replayed.orderId).toBe(created.orderId);
    expect(replayed.replay).toBe(true);

    const afterReplay = await listSnapshots(staff.cashierA.email);
    const tickReplay = tickOperationalOrderMonitor(
      {
        orders: afterReplay,
        observedIds: tick.observedIds,
        baselineDone: true,
        emitPendingAlerts: true,
      },
      tick.fingerprint,
    );
    expect(tickReplay.newOrders).toEqual([]);
    expect(tickReplay.shouldToast).toBe(false);
  });

  it("E/F: cashier branch B no ve order A; owner sí", async () => {
    const created = await createOrder(BRANCH_A, crypto.randomUUID(), "delivery");
    const listB = await listSnapshots(staff.cashierB.email);
    expect(listB.some((o) => o.id === created.orderId)).toBe(false);
    const listOwner = await listSnapshots(staff.owner.email);
    expect(listOwner.some((o) => o.id === created.orderId)).toBe(true);
  });

  it("I/J: pickup/delivery detectados; pending→confirmed baja contador", async () => {
    const pickup = await createOrder(BRANCH_A, crypto.randomUUID(), "pickup");
    const delivery = await createOrder(BRANCH_A, crypto.randomUUID(), "delivery");
    const list = await listSnapshots(staff.managerA.email);
    expect(list.some((o) => o.id === pickup.orderId && o.fulfillmentType === "pickup")).toBe(true);
    expect(list.some((o) => o.id === delivery.orderId && o.fulfillmentType === "delivery")).toBe(true);

    const pendingBefore = countPendingAttention(list.filter((o) => o.id === pickup.orderId));
    expect(pendingBefore).toBe(1);

    const cashier = await clientAs(staff.cashierA.email);
    const { error } = await cashier
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", pickup.orderId)
      .eq("status", "pending");
    expect(error).toBeNull();

    const after = await listSnapshots(staff.managerA.email);
    expect(countPendingAttention(after.filter((o) => o.id === pickup.orderId))).toBe(0);
  });
});
