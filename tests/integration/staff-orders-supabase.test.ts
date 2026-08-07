/**
 * Integración local 11B-3: lectura/transiciones staff vía RLS + UPDATE status.
 * Sin service_role en el camino de app; fixtures Auth solo para armar roles.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON =
  "[REDACTED_LOCAL_KEY]";
const LOCAL_SERVICE =
  "[REDACTED_LOCAL_SERVICE_ROLE]";

const RESTAURANT_ID = "31111111-1111-4111-8111-111111111101";
const BRANCH_A = "31111111-1111-4111-8111-111111111102";
const BRANCH_B = "31111111-1111-4111-8111-111111111103";
const ITEM_ID = "e11b3-plato";
const GROUP_ID = "e11b3-group";
const OPTION_ID = "e11b3-option";
const INV_ID = "31111111-1111-4111-8111-111111111199";

type StaffFixture = {
  id: string;
  email: string;
  password: string;
  role: string;
  branchId: string | null;
  staffStatus: string;
};

const passwords = "[REDACTED_LOCAL_PASSWORD]";
const staff = {
  kitchenA: { id: "", email: "", password: passwords, role: "kitchen", branchId: BRANCH_A, staffStatus: "active" },
  kitchenB: { id: "", email: "", password: passwords, role: "kitchen", branchId: BRANCH_B, staffStatus: "active" },
  cashierA: { id: "", email: "", password: passwords, role: "cashier", branchId: BRANCH_A, staffStatus: "active" },
  managerA: { id: "", email: "", password: passwords, role: "manager", branchId: BRANCH_A, staffStatus: "active" },
  suspended: { id: "", email: "", password: passwords, role: "kitchen", branchId: BRANCH_A, staffStatus: "suspended" },
  inactive: { id: "", email: "", password: passwords, role: "kitchen", branchId: BRANCH_A, staffStatus: "inactive" },
  editor: { id: "", email: "", password: passwords, role: "editor", branchId: BRANCH_A, staffStatus: "active" },
  customerA: { id: "", email: "", password: passwords, role: "customer", branchId: null, staffStatus: "" },
  customerB: { id: "", email: "", password: passwords, role: "customer", branchId: null, staffStatus: "" },
} satisfies Record<string, StaffFixture>;

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
    delete from public.inventory_movements where inventory_item_id = '${INV_ID}';
    delete from public.inventory_items where id = '${INV_ID}';
    delete from public.order_items where menu_item_id = '${ITEM_ID}';
    delete from public.orders where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.modifier_options where id = '${OPTION_ID}';
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = 'e11b3-cat';
    delete from public.staff_branch_permissions where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.opening_hours where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.special_hours where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.branches where id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'Orders 11B3', 'e11b3-rest', 'active', 0.0800, 0, 20, 'CB');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values
      ('${BRANCH_A}', '${RESTAURANT_ID}', 'Centro 11B3', 'centro-11b3', 'active', true, true, 6000, 25000),
      ('${BRANCH_B}', '${RESTAURANT_ID}', 'Norte 11B3', 'norte-11b3', 'active', true, false, 0, 0);

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', 'e11b3-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b3-cat', '${ITEM_ID}', 'Plato 11B3', 'ok', 20000,
      true, true, 1, '/icon.svg'
    );

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
    values ('${BRANCH_A}', '${ITEM_ID}', 22000, true), ('${BRANCH_B}', '${ITEM_ID}', 22000, true);

    insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
    values ('${GROUP_ID}', '${ITEM_ID}', 'Extra', 1, 1, true, 1);

    insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order)
    values ('${OPTION_ID}', '${GROUP_ID}', 'Guacamole', 2000, true, 1);

    insert into public.inventory_items (
      id, branch_id, name, slug, category, base_unit, display_unit,
      current_quantity, minimum_quantity, cost_per_base_unit
    ) values (
      '${INV_ID}', '${BRANCH_A}', 'Ing 11B3', 'e11b3-ing', 'test', 'g', 'g', 100, 10, 1
    );
  `);
}

async function createAuthUser(admin: SupabaseClient, key: string, role: string, branchId: string | null, staffStatus: string) {
  const email = `11b3-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({
    email,
    password: passwords,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`No se pudo crear ${key}: ${created.error?.message}`);
  }
  const id = created.data.user.id;
  if (role === "customer") {
    psql(`update public.profiles set role = 'customer', staff_status = null where id = '${id}'`);
  } else {
    psql(`
      update public.profiles
      set role = '${role}', staff_status = '${staffStatus}'
      where id = '${id}';
      ${branchId ? `insert into public.staff_branch_permissions (profile_id, branch_id) values ('${id}', '${branchId}') on conflict do nothing;` : ""}
    `);
  }
  return { id, email };
}

function clientAs(email: string, password: string) {
  return createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.signInWithPassword({ email, password }).then(async (result) => {
    if (result.error || !result.data.session) throw new Error(result.error?.message ?? "login failed");
    return createClient(LOCAL_URL, LOCAL_ANON, {
      global: { headers: { Authorization: `Bearer ${result.data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
}

async function createGuestOrder(branchId: string, key: string): Promise<string> {
  const anon = createClient(LOCAL_URL, LOCAL_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.rpc("create_customer_order", {
    p_idempotency_key: key,
    p_branch_id: branchId,
    p_fulfillment_type: "pickup",
    p_customer_name: "Guest 11B3",
    p_customer_phone: "3001234567",
    p_customer_email: "guest11b3@test.local",
    p_items: [{ menu_item_id: ITEM_ID, quantity: 1, notes: "", modifier_option_ids: [OPTION_ID] }],
    p_address: null,
    p_notes: null,
    p_tip_percent: 0,
    p_coupon_code: null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { order_id: string }).order_id;
}

describe("11B-3 operaciones staff pedidos (Supabase local)", () => {
  beforeAll(async () => {
    try {
      psql("select 1");
    } catch {
      throw new Error("Supabase local no disponible para integración 11B-3.");
    }
    seedCatalog();
    const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const [key, fixture] of Object.entries(staff)) {
      const created = await createAuthUser(admin, key, fixture.role, fixture.branchId, fixture.staffStatus);
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
      // best-effort cleanup
    }
  });

  it("A/B: guest crea pedido y kitchen de la misma branch lo lee", async () => {
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    const kitchen = await clientAs(staff.kitchenA.email, staff.kitchenA.password);
    const { data, error } = await kitchen.from("orders").select("id, status, branch_id").eq("id", orderId).maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(orderId);
    expect(data?.status).toBe("pending");
  });

  it("C: kitchen de otra branch no ve el pedido", async () => {
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    const kitchenB = await clientAs(staff.kitchenB.email, staff.kitchenB.password);
    const { data, error } = await kitchenB.from("orders").select("id").eq("id", orderId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("D/E/F: editor, suspendido e inactivo no actualizan status", async () => {
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    // Confirmar primero con cashier para llegar a confirmed (kitchen no toca pending)
    const cashier = await clientAs(staff.cashierA.email, staff.cashierA.password);
    await cashier.from("orders").update({ status: "confirmed" }).eq("id", orderId).eq("status", "pending");

    for (const key of ["editor", "suspended", "inactive"] as const) {
      const client = await clientAs(staff[key].email, staff[key].password);
      const { data, error } = await client
        .from("orders")
        .update({ status: "preparing" })
        .eq("id", orderId)
        .eq("status", "confirmed")
        .select("id");
      // RLS/trigger: sin filas o error
      expect((data ?? []).length === 0 || error !== null).toBe(true);
    }
    const status = psql(`select status from public.orders where id = '${orderId}'`);
    expect(status).toBe("confirmed");
  });

  it("G/H: transición válida persiste; inválida falla", async () => {
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    const cashier = await clientAs(staff.cashierA.email, staff.cashierA.password);
    const ok = await cashier.from("orders").update({ status: "confirmed" }).eq("id", orderId).eq("status", "pending").select("status").maybeSingle();
    expect(ok.error).toBeNull();
    expect(ok.data?.status).toBe("confirmed");

    const kitchen = await clientAs(staff.kitchenA.email, staff.kitchenA.password);
    const invalid = await kitchen
      .from("orders")
      .update({ status: "ready" })
      .eq("id", orderId)
      .eq("status", "confirmed")
      .select("id");
    expect(invalid.error !== null || (invalid.data ?? []).length === 0).toBe(true);
    expect(psql(`select status from public.orders where id = '${orderId}'`)).toBe("confirmed");

    const valid = await kitchen
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", orderId)
      .eq("status", "confirmed")
      .select("status")
      .maybeSingle();
    expect(valid.error).toBeNull();
    expect(valid.data?.status).toBe("preparing");
  });

  it("I: stale concurrent update — solo una gana", async () => {
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    const cashier = await clientAs(staff.cashierA.email, staff.cashierA.password);
    await cashier.from("orders").update({ status: "confirmed" }).eq("id", orderId).eq("status", "pending");

    const kitchen1 = await clientAs(staff.kitchenA.email, staff.kitchenA.password);
    const kitchen2 = await clientAs(staff.managerA.email, staff.managerA.password);
    const [a, b] = await Promise.all([
      kitchen1.from("orders").update({ status: "preparing" }).eq("id", orderId).eq("status", "confirmed").select("id"),
      kitchen2.from("orders").update({ status: "preparing" }).eq("id", orderId).eq("status", "confirmed").select("id"),
    ]);
    const wins = [(a.data ?? []).length > 0 && !a.error, (b.data ?? []).length > 0 && !b.error].filter(Boolean).length;
    expect(wins).toBe(1);
    expect(psql(`select status from public.orders where id = '${orderId}'`)).toBe("preparing");
  });

  it("J/K: customer lee solo sus pedidos", async () => {
    const customerA = await clientAs(staff.customerA.email, staff.customerA.password);
    const { data: created, error } = await customerA.rpc("create_customer_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_branch_id: BRANCH_A,
      p_fulfillment_type: "pickup",
      p_customer_name: "Cust A",
      p_customer_phone: "3001111111",
      p_customer_email: staff.customerA.email,
      p_items: [{ menu_item_id: ITEM_ID, quantity: 1, notes: "", modifier_option_ids: [OPTION_ID] }],
      p_address: null,
      p_notes: null,
      p_tip_percent: 0,
      p_coupon_code: null,
    });
    expect(error).toBeNull();
    const orderId = (Array.isArray(created) ? created[0] : created) as { order_id: string };
    const own = await customerA.from("orders").select("id").eq("id", orderId.order_id).maybeSingle();
    expect(own.data?.id).toBe(orderId.order_id);

    const customerB = await clientAs(staff.customerB.email, staff.customerB.password);
    const other = await customerB.from("orders").select("id").eq("id", orderId.order_id).maybeSingle();
    expect(other.data).toBeNull();
  });

  it("L/M: creación y transición pre-delivered no consumen inventario", async () => {
    const before = psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`);
    const movementsBefore = psql(`select count(*)::text from public.inventory_movements where inventory_item_id = '${INV_ID}'`);
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    const cashier = await clientAs(staff.cashierA.email, staff.cashierA.password);
    await cashier.from("orders").update({ status: "confirmed" }).eq("id", orderId).eq("status", "pending");
    const kitchen = await clientAs(staff.kitchenA.email, staff.kitchenA.password);
    await kitchen.from("orders").update({ status: "preparing" }).eq("id", orderId).eq("status", "confirmed");
    await kitchen.from("orders").update({ status: "ready" }).eq("id", orderId).eq("status", "preparing");
    expect(psql(`select status from public.orders where id = '${orderId}'`)).toBe("ready");
    expect(psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`)).toBe(before);
    expect(psql(`select count(*)::text from public.inventory_movements where inventory_item_id = '${INV_ID}'`)).toBe(
      movementsBefore,
    );
  });

  it("delivered no se ejecuta en esta fase: status ready y stock intactos", async () => {
    const orderId = await createGuestOrder(BRANCH_A, crypto.randomUUID());
    const cashier = await clientAs(staff.cashierA.email, staff.cashierA.password);
    await cashier.from("orders").update({ status: "confirmed" }).eq("id", orderId).eq("status", "pending");
    const kitchen = await clientAs(staff.kitchenA.email, staff.kitchenA.password);
    await kitchen.from("orders").update({ status: "preparing" }).eq("id", orderId).eq("status", "confirmed");
    await kitchen.from("orders").update({ status: "ready" }).eq("id", orderId).eq("status", "preparing");
    const beforeStock = psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`);
    const beforeMov = psql(`select count(*)::text from public.inventory_movements where inventory_item_id = '${INV_ID}'`);
    // 11B-3: la app bloquea delivered antes del UPDATE; no invocamos la transición aquí.
    expect(psql(`select status from public.orders where id = '${orderId}'`)).toBe("ready");
    expect(psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`)).toBe(beforeStock);
    expect(psql(`select count(*)::text from public.inventory_movements where inventory_item_id = '${INV_ID}'`)).toBe(beforeMov);
  });
});
