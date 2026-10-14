/**
 * Integración local 11B-6: mesas QR, pedidos local, cobros manuales vía RPC.
 * Service_role solo para Auth fixtures; sin service_role en el camino de app.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalSupabaseServerEnv } from "../helpers/local-supabase-env";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  url: LOCAL_URL,
  anonKey: LOCAL_ANON,
  serviceRoleKey: LOCAL_SERVICE,
  testPassword: LOCAL_TEST_PASSWORD,
} = getLocalSupabaseServerEnv();

const PREFIX = "e11b6i";
const RESTAURANT_ID = "61111111-1111-4111-8111-111111111101";
const BRANCH_ID = "61111111-1111-4111-8111-111111111102";
const ITEM_ID = `${PREFIX}-plato`;
const PASSWORD = LOCAL_TEST_PASSWORD;

type Actor = { id: string; email: string };

const actors: {
  owner: Actor;
  manager: Actor;
  cashier: Actor;
} = {
  owner: { id: "", email: "" },
  manager: { id: "", email: "" },
  cashier: { id: "", email: "" },
};

let tableId = "";
let qrToken = "";
let sessionId = "";
let sessionOrderA = "";
let sessionOrderB = "";
let pickupOrderId = "";
let pickupConfirmationId = "";
let activeClient: SupabaseClient | null = null;

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

function cleanupBranchData() {
  psql(`
    set session_replication_role = replica;
    delete from public.manual_payment_voids
      where confirmation_id in (
        select id from public.manual_payment_confirmations where branch_id = '${BRANCH_ID}'
      );
    delete from public.manual_payment_allocations
      where confirmation_id in (
        select id from public.manual_payment_confirmations where branch_id = '${BRANCH_ID}'
      );
    delete from public.manual_payment_confirmations where branch_id = '${BRANCH_ID}';
    delete from public.order_items where order_id in (
      select id from public.orders where branch_id = '${BRANCH_ID}'
    );
    delete from public.orders where branch_id = '${BRANCH_ID}';
    delete from public.table_sessions where branch_id = '${BRANCH_ID}';
    delete from public.dining_tables where branch_id = '${BRANCH_ID}';
    delete from public.audit_log where branch_id = '${BRANCH_ID}';
    set session_replication_role = DEFAULT;
  `);
}

function seedCatalog() {
  cleanupBranchData();
  psql(`
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = '${PREFIX}-cat';
    delete from public.staff_branch_permissions where branch_id = '${BRANCH_ID}';
    delete from public.opening_hours where branch_id = '${BRANCH_ID}';
    delete from public.special_hours where branch_id = '${BRANCH_ID}';
    delete from public.branches where id = '${BRANCH_ID}';
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'Dining 11B6i', '${PREFIX}-rest', 'active', 0.0800, 0, 20, 'DT');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values ('${BRANCH_ID}', '${RESTAURANT_ID}', 'Centro 11B6i', '${PREFIX}-centro', 'active', true, true, 6000, 25000);
    insert into public.opening_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
    select '${BRANCH_ID}'::uuid, day, time '00:00', time '23:59', false
    from generate_series(0, 6) as day;

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', '${PREFIX}-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path, is_independently_orderable
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', '${PREFIX}-cat', '${ITEM_ID}', 'Plato 11B6i', 'ok', 10000,
      true, true, 1, '/icon.svg', true
    );

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
    values ('${BRANCH_ID}', '${ITEM_ID}', 10000, true);
  `);
}

async function createActor(admin: SupabaseClient, key: keyof typeof actors, role: string) {
  const email = `${PREFIX}-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`No se pudo crear ${key}: ${created.error?.message}`);
  }
  const id = created.data.user.id;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (psql(`select count(*)::text from public.profiles where id = '${id}'`) === "1") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  psql(`
    update public.profiles
    set role = '${role}', staff_status = 'active', name = '${key}'
    where id = '${id}';
    insert into public.staff_branch_permissions (profile_id, branch_id)
    values ('${id}', '${BRANCH_ID}') on conflict do nothing;
  `);
  actors[key] = { id, email };
}

async function clientAs(email: string): Promise<SupabaseClient> {
  const base = createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await base.auth.signInWithPassword({ email, password: PASSWORD });
  if (result.error || !result.data.session) {
    throw new Error(result.error?.message ?? "login failed");
  }
  return createClient(LOCAL_URL, LOCAL_ANON, {
    global: { headers: { Authorization: `Bearer ${result.data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function withAuthedRepo<T>(email: string, run: () => Promise<T>): Promise<T> {
  activeClient = await clientAs(email);
  try {
    return await run();
  } finally {
    activeClient = null;
  }
}

async function createOrder(opts: {
  fulfillment: "local" | "pickup";
  qrToken?: string;
  key?: string;
}): Promise<string> {
  const anon = anonClient();
  const { data, error } = await anon.rpc("create_customer_order", {
    p_idempotency_key: opts.key ?? crypto.randomUUID(),
    p_branch_id: BRANCH_ID,
    p_fulfillment_type: opts.fulfillment,
    p_customer_name: "Guest 11B6i",
    p_customer_phone: "3001234567",
    p_customer_email: "guest11b6i@test.local",
    p_items: [{ menu_item_id: ITEM_ID, quantity: 1, notes: "", modifier_option_ids: [] }],
    p_address: null,
    p_notes: null,
    p_tip_percent: 0,
    p_coupon_code: null,
    p_table_qr_token: opts.qrToken ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { order_id: string }).order_id;
}

describe("11B-6 mesas/cobros (Supabase local)", () => {
  beforeAll(async () => {
    try {
      psql("select 1");
    } catch {
      throw new Error("Supabase local no disponible para integración 11B-6.");
    }

    process.env.DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON;

    seedCatalog();

    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: async () => {
        if (!activeClient) {
          throw new Error("createServerSupabaseClient mock: no authenticated client set");
        }
        return activeClient;
      },
    }));
    vi.doMock("@/lib/env/server", () => ({
      getResolvedDataMode: () => "supabase",
    }));

    const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await createActor(admin, "owner", "owner");
    await createActor(admin, "manager", "manager");
    await createActor(admin, "cashier", "cashier");
  }, 120_000);

  afterAll(() => {
    try {
      const ids = Object.values(actors)
        .map((a) => a.id)
        .filter(Boolean)
        .map((id) => `'${id}'`)
        .join(",");
      seedCatalog();
      if (ids) {
        psql(`
          delete from public.staff_branch_permissions where profile_id in (${ids});
          delete from public.profiles where id in (${ids});
          delete from auth.users where id in (${ids});
        `);
      }
    } catch {
      // best-effort
    }
  });

  it("A: owner creates table + raw token (repo)", async () => {
    const { SupabaseDiningTablesRepository } = await import("@/server/dining-tables/repository");
    const cred = await withAuthedRepo(actors.owner.email, () =>
      new SupabaseDiningTablesRepository().createDiningTable({
        branchId: BRANCH_ID,
        code: "T1",
        name: "Mesa 1",
      }),
    );
    expect(cred.tableId).toBeTruthy();
    expect(cred.qrToken).toMatch(/^[0-9a-f]{64}$/);
    expect(cred.code).toBe("T1");
    tableId = cred.tableId;
    qrToken = cred.qrToken;
    const storedHash = psql(
      `select encode(qr_token_hash, 'hex') from public.dining_tables where id = '${tableId}'`,
    );
    expect(storedHash).toHaveLength(64);
    expect(storedHash).not.toBe(qrToken);
  });

  it("B: manager/cashier cannot create", async () => {
    for (const key of ["manager", "cashier"] as const) {
      const client = await clientAs(actors[key].email);
      const { error } = await client.rpc("create_dining_table", {
        p_branch_id: BRANCH_ID,
        p_code: `X-${key}`,
        p_name: "Blocked",
      });
      expect(error).not.toBeNull();
    }
  });

  it("C: resolve QR opens/reuses session", async () => {
    const anon = anonClient();
    const first = await anon.rpc("resolve_table_qr", { p_qr_token: qrToken });
    expect(first.error).toBeNull();
    const payload = first.data as { session_id: string; table_id: string };
    expect(payload.table_id).toBe(tableId);
    sessionId = payload.session_id;
    expect(psql(`select status from public.table_sessions where id = '${sessionId}'`)).toBe("open");

    const second = await anon.rpc("resolve_table_qr", { p_qr_token: qrToken });
    expect(second.error).toBeNull();
    expect((second.data as { session_id: string }).session_id).toBe(sessionId);
  });

  it("D: guest create_customer_order local with token", async () => {
    sessionOrderA = await createOrder({ fulfillment: "local", qrToken });
    const row = psql(
      `select table_session_id || '|' || fulfillment_type || '|' || status from public.orders where id = '${sessionOrderA}'`,
    );
    expect(row).toBe(`${sessionId}|local|pending`);
  });

  it("E: second order same session", async () => {
    sessionOrderB = await createOrder({ fulfillment: "local", qrToken });
    expect(
      psql(`select table_session_id from public.orders where id = '${sessionOrderB}'`),
    ).toBe(sessionId);
    expect(sessionOrderB).not.toBe(sessionOrderA);
  });

  it("F: cashier confirm session cash → closed; I: status unchanged", async () => {
    const statusBefore = psql(`select status from public.orders where id = '${sessionOrderA}'`);
    expect(statusBefore).toBe("pending");

    const cashier = await clientAs(actors.cashier.email);
    const { data, error } = await cashier.rpc("confirm_manual_table_session_payment", {
      p_session_id: sessionId,
      p_method: "cash",
      p_reference: "",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect((data as { replay: boolean }).replay).toBe(false);

    expect(psql(`select status from public.table_sessions where id = '${sessionId}'`)).toBe("closed");
    expect(psql(`select payment_status from public.orders where id = '${sessionOrderA}'`)).toBe("paid");
    expect(psql(`select payment_status from public.orders where id = '${sessionOrderB}'`)).toBe("paid");
    // I — payment does not change order.status
    expect(psql(`select status from public.orders where id = '${sessionOrderA}'`)).toBe("pending");
    expect(psql(`select status from public.orders where id = '${sessionOrderB}'`)).toBe("pending");
  });

  it("G: manager confirm_manual_order_payment pickup (no table)", async () => {
    pickupOrderId = await createOrder({ fulfillment: "pickup" });
    expect(psql(`select table_session_id::text from public.orders where id = '${pickupOrderId}'`)).toBe(
      "",
    );

    const manager = await clientAs(actors.manager.email);
    const { data, error } = await manager.rpc("confirm_manual_order_payment", {
      p_order_id: pickupOrderId,
      p_method: "cash",
      p_reference: "REF-PICKUP",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(error).toBeNull();
    expect((data as { replay: boolean }).replay).toBe(false);

    pickupConfirmationId = psql(
      `select active_manual_payment_confirmation_id::text from public.orders where id = '${pickupOrderId}'`,
    );
    expect(pickupConfirmationId).toBeTruthy();
    expect(psql(`select payment_status || '|' || status from public.orders where id = '${pickupOrderId}'`)).toBe(
      "paid|pending",
    );
  });

  it("H: cashier cannot void; owner can void", async () => {
    const cashier = await clientAs(actors.cashier.email);
    const denied = await cashier.rpc("void_manual_payment_confirmation", {
      p_confirmation_id: pickupConfirmationId,
      p_reason: "intento cashier",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(denied.error).not.toBeNull();
    expect(psql(`select payment_status from public.orders where id = '${pickupOrderId}'`)).toBe("paid");

    const owner = await clientAs(actors.owner.email);
    const voided = await owner.rpc("void_manual_payment_confirmation", {
      p_confirmation_id: pickupConfirmationId,
      p_reason: "anular cobro prueba 11b6i",
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(voided.error).toBeNull();
    expect((voided.data as { replay: boolean }).replay).toBe(false);
    expect(psql(`select payment_status from public.orders where id = '${pickupOrderId}'`)).toBe("pending");
  });

  it("J: rotation invalidates old token", async () => {
    const oldToken = qrToken;
    const owner = await clientAs(actors.owner.email);
    const { data, error } = await owner.rpc("rotate_dining_table_qr", { p_table_id: tableId });
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    const next = row as { qr_token: string; table_id: string };
    expect(next.table_id).toBe(tableId);
    expect(next.qr_token).toMatch(/^[0-9a-f]{64}$/);
    expect(next.qr_token).not.toBe(oldToken);
    qrToken = next.qr_token;

    const anon = anonClient();
    const stale = await anon.rpc("resolve_table_qr", { p_qr_token: oldToken });
    expect(stale.error).not.toBeNull();

    const fresh = await anon.rpc("resolve_table_qr", { p_qr_token: qrToken });
    expect(fresh.error).toBeNull();
    expect((fresh.data as { table_id: string }).table_id).toBe(tableId);
  });
});
