import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { skipOnboarding } from "./helpers";

/**
 * E2E dirigidos 11B-3: operaciones staff sobre pedidos reales (Supabase local).
 * Requiere AUTH_MODE=supabase + DATA_MODE=supabase (ver playwright.staff-orders-supabase.config.ts).
 */

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON =
  "[REDACTED_LOCAL_KEY]";
const LOCAL_SERVICE =
  "[REDACTED_LOCAL_SERVICE_ROLE]";

const RESTAURANT_ID = "41111111-1111-4111-8111-111111111101";
const BRANCH_A = "41111111-1111-4111-8111-111111111102";
const BRANCH_B = "41111111-1111-4111-8111-111111111103";
const ITEM_ID = "e11b3e2e-plato";
const GROUP_ID = "e11b3e2e-group";
const OPTION_ID = "e11b3e2e-option";
const INV_ID = "41111111-1111-4111-8111-111111111201";
const RECIPE_ID = "41111111-1111-4111-8111-111111111202";
const PASSWORD = "[REDACTED_LOCAL_PASSWORD]";

const users = {
  kitchenA: { id: "", email: "" },
  kitchenB: { id: "", email: "" },
  cashierA: { id: "", email: "" },
  managerA: { id: "", email: "" },
  editorA: { id: "", email: "" },
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

function seed() {
  psql(`
    set session_replication_role = replica;
    delete from public.audit_log where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.inventory_consumption_sources where inventory_item_id = '${INV_ID}';
    delete from public.inventory_movements where inventory_item_id = '${INV_ID}';
    delete from public.order_items where menu_item_id = '${ITEM_ID}';
    delete from public.orders where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    set session_replication_role = DEFAULT;
    delete from public.recipe_items where recipe_id = '${RECIPE_ID}';
    delete from public.recipes where id = '${RECIPE_ID}';
    delete from public.inventory_items where id = '${INV_ID}';
    delete from public.modifier_options where id = '${OPTION_ID}';
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = 'e11b3e2e-cat';
    delete from public.staff_branch_permissions where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.opening_hours where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.special_hours where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.branches where id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.branches where slug in ('centro', 'norte');
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'E2E 11B3', 'e11b3e2e-rest', 'active', 0.0800, 0, 20, 'CB');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values
      ('${BRANCH_A}', '${RESTAURANT_ID}', 'Centro E2E', 'centro', 'active', true, true, 6000, 25000),
      ('${BRANCH_B}', '${RESTAURANT_ID}', 'Norte E2E', 'norte', 'active', true, false, 0, 0);

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', 'e11b3e2e-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b3e2e-cat', '${ITEM_ID}', 'Plato E2E 11B3', 'ok', 20000,
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
      '${INV_ID}', '${BRANCH_A}', 'Insumo E2E', 'e11b3e2e-insumo', 'test', 'g', 'g', 500, 50, 1
    );
    insert into public.recipes (id, product_id, branch_id, portion_yield)
    values ('${RECIPE_ID}', '${ITEM_ID}', '${BRANCH_A}', 1);
    insert into public.recipe_items (recipe_id, inventory_item_id, quantity_required, base_unit)
    values ('${RECIPE_ID}', '${INV_ID}', 60, 'g');
  `);
}

async function createStaff(
  admin: { auth: { admin: { createUser: (args: { email: string; password: string; email_confirm: boolean }) => Promise<{ data: { user: { id: string } | null }; error: { message?: string } | null }> } } },
  key: keyof typeof users,
  role: string,
  branchId: string,
) {
  const email = `e2e-11b3-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "create user");
  const id = created.data.user.id;

  // Esperar a que el trigger cree el perfil customer y luego promover a staff activo.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const exists = psql(`select count(*)::text from public.profiles where id = '${id}'`);
    if (exists === "1") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  psql(`
    update public.profiles
    set role = '${role}',
        staff_status = 'active',
        name = '${role} E2E'
    where id = '${id}';
    delete from public.staff_branch_permissions where profile_id = '${id}';
    insert into public.staff_branch_permissions (profile_id, branch_id)
    values ('${id}', '${branchId}');
  `);

  const verified = psql(
    `select role || ':' || coalesce(staff_status, 'null') from public.profiles where id = '${id}'`,
  );
  if (verified !== `${role}:active`) {
    throw new Error(`No se pudo promover el perfil ${key}: got ${verified}`);
  }
  const branchOk = psql(
    `select count(*)::text from public.staff_branch_permissions where profile_id = '${id}' and branch_id = '${branchId}'`,
  );
  if (branchOk !== "1") {
    throw new Error(`No se pudo asignar sucursal a ${key}`);
  }

  users[key] = { id, email };
}

async function createOrder(branchId: string): Promise<{ id: string; orderNumber: string }> {
  const anon = createClient(LOCAL_URL, LOCAL_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.rpc("create_customer_order", {
    p_idempotency_key: crypto.randomUUID(),
    p_branch_id: branchId,
    p_fulfillment_type: "pickup",
    p_customer_name: "Cliente E2E",
    p_customer_phone: "3009998877",
    p_customer_email: "cliente-e2e@test.local",
    p_items: [{ menu_item_id: ITEM_ID, quantity: 1, notes: "sin cebolla", modifier_option_ids: [OPTION_ID] }],
    p_address: null,
    p_notes: "nota e2e",
    p_tip_percent: 0,
    p_coupon_code: null,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: string };
  return { id: row.order_id, orderNumber: row.order_number };
}

async function login(page: Page, email: string) {
  await skipOnboarding(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/(empleado|admin)(\/|$|\?)/, { timeout: 45_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  await page.waitForLoadState("networkidle");
}

test.beforeAll(async () => {
  try {
    psql("select 1");
  } catch {
    throw new Error("Supabase local no disponible para E2E staff orders.");
  }
  seed();
  const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await createStaff(admin, "kitchenA", "kitchen", BRANCH_A);
  await createStaff(admin, "kitchenB", "kitchen", BRANCH_B);
  await createStaff(admin, "cashierA", "cashier", BRANCH_A);
  await createStaff(admin, "managerA", "manager", BRANCH_A);
  await createStaff(admin, "editorA", "editor", BRANCH_A);
});

test.afterAll(() => {
  try {
    const ids = Object.values(users)
      .map((u) => u.id)
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
    seed();
  } catch {
    // best-effort
  }
});

test.describe("Staff orders Supabase local", () => {
  const orderInQueue = (page: Page, orderNumber: string) =>
    page.getByLabel("Cola de pedidos").locator("article").filter({ hasText: `#${orderNumber}` });

  test("pedido real aparece para kitchen autorizado con snapshots", async ({ page }) => {
    const order = await createOrder(BRANCH_A);
    await login(page, users.kitchenA.email);
    await expect(page).toHaveURL(/\/empleado/);
    await expect(page.getByRole("heading", { name: "Cola de pedidos" })).toBeVisible();
    await expect(orderInQueue(page, order.orderNumber)).toBeVisible();
    await expect(orderInQueue(page, order.orderNumber)).toContainText("Plato E2E 11B3");
    await expect(orderInQueue(page, order.orderNumber)).toContainText("Guacamole");
    await expect(orderInQueue(page, order.orderNumber)).toContainText(/pago pending/i);
  });

  test("kitchen de otra branch no ve el pedido", async ({ page }) => {
    const order = await createOrder(BRANCH_A);
    await login(page, users.kitchenB.email);
    await expect(page).toHaveURL(/\/empleado/);
    await expect(orderInQueue(page, order.orderNumber)).toHaveCount(0);
  });

  test("editor no ve cola de pedidos", async ({ page }) => {
    await createOrder(BRANCH_A);
    await login(page, users.editorA.email);
    await expect(page).toHaveURL(/\/empleado/);
    await expect(page.getByRole("heading", { name: "Cola de pedidos" })).toHaveCount(0);
  });

  test("cashier confirma, entrega con inventario y refresh conserva delivered", async ({ page }) => {
    const order = await createOrder(BRANCH_A);
    const stockBefore = Number(
      psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`),
    );
    await login(page, users.cashierA.email);
    await expect(orderInQueue(page, order.orderNumber)).toBeVisible();
    await orderInQueue(page, order.orderNumber).getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Pedido actualizado")).toBeVisible();
    await page.reload();
    await expect(orderInQueue(page, order.orderNumber)).toBeVisible();
    expect(psql(`select status from public.orders where id = '${order.id}'`)).toBe("confirmed");

    // Avance cocina hasta ready
    const kitchenClient = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const session = await kitchenClient.auth.signInWithPassword({
      email: users.kitchenA.email,
      password: PASSWORD,
    });
    if (!session.data.session) throw new Error("kitchen login failed");
    const authed = createClient(LOCAL_URL, LOCAL_ANON, {
      global: { headers: { Authorization: `Bearer ${session.data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await authed.from("orders").update({ status: "preparing" }).eq("id", order.id).eq("status", "confirmed");
    await authed.from("orders").update({ status: "ready" }).eq("id", order.id).eq("status", "preparing");

    await page.reload();
    await expect(orderInQueue(page, order.orderNumber)).toBeVisible();
    await expect(orderInQueue(page, order.orderNumber).getByRole("button", { name: "Entregar" })).toBeVisible();
    await orderInQueue(page, order.orderNumber).getByRole("button", { name: "Entregar" }).click();
    await expect(page.getByText("Pedido actualizado")).toBeVisible();
    await page.reload();
    await expect(orderInQueue(page, order.orderNumber)).toContainText(/Entregado|delivered/i);
    expect(psql(`select status from public.orders where id = '${order.id}'`)).toBe("delivered");
    expect(psql(`select payment_status from public.orders where id = '${order.id}'`)).toBe("pending");
    const stockAfter = Number(
      psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`),
    );
    expect(stockAfter).toBe(stockBefore - 60);
    const movements = Number(
      psql(
        `select count(*)::text from public.inventory_movements where order_id = '${order.id}' and movement_type = 'consumption'`,
      ),
    );
    expect(movements).toBe(1);

    // Doble acción: terminal → sin segundo consumo
    await expect(orderInQueue(page, order.orderNumber).getByRole("button", { name: "Entregar" })).toHaveCount(0);
    expect(
      Number(
        psql(
          `select count(*)::text from public.inventory_movements where order_id = '${order.id}' and movement_type = 'consumption'`,
        ),
      ),
    ).toBe(1);
  });

  test("stock insuficiente muestra error y pedido sigue ready", async ({ page }) => {
    const order = await createOrder(BRANCH_A);

    const cashierClient = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const cashierSession = await cashierClient.auth.signInWithPassword({
      email: users.cashierA.email,
      password: PASSWORD,
    });
    const cashierAuthed = createClient(LOCAL_URL, LOCAL_ANON, {
      global: { headers: { Authorization: `Bearer ${cashierSession.data.session!.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await cashierAuthed.from("orders").update({ status: "confirmed" }).eq("id", order.id).eq("status", "pending");

    const kitchenClient = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const kitchenSession = await kitchenClient.auth.signInWithPassword({
      email: users.kitchenA.email,
      password: PASSWORD,
    });
    const kitchenAuthed = createClient(LOCAL_URL, LOCAL_ANON, {
      global: { headers: { Authorization: `Bearer ${kitchenSession.data.session!.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await kitchenAuthed.from("orders").update({ status: "preparing" }).eq("id", order.id).eq("status", "confirmed");
    await kitchenAuthed.from("orders").update({ status: "ready" }).eq("id", order.id).eq("status", "preparing");

    const stockBefore = Number(
      psql(`select current_quantity::text from public.inventory_items where id = '${INV_ID}'`),
    );
    psql(`update public.inventory_items set current_quantity = 1 where id = '${INV_ID}'`);

    await login(page, users.cashierA.email);
    await expect(orderInQueue(page, order.orderNumber).getByRole("button", { name: "Entregar" })).toBeVisible();
    await orderInQueue(page, order.orderNumber).getByRole("button", { name: "Entregar" }).click();
    await expect(page.getByText(/el inventario de la sucursal no alcanza/i)).toBeVisible();
    expect(psql(`select status from public.orders where id = '${order.id}'`)).toBe("ready");
    expect(
      Number(
        psql(
          `select count(*)::text from public.inventory_movements where order_id = '${order.id}' and movement_type = 'consumption'`,
        ),
      ),
    ).toBe(0);
    psql(`update public.inventory_items set current_quantity = ${stockBefore} where id = '${INV_ID}'`);
  });

  test("manager transición válida y stale conflict", async ({ page }) => {
    const order = await createOrder(BRANCH_A);
    await login(page, users.managerA.email);
    const card = orderInQueue(page, order.orderNumber);
    await card.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Pedido actualizado")).toBeVisible();
    await expect(card.getByRole("button", { name: "Preparar" })).toBeVisible();

    // Otro actor mueve el pedido mientras la UI aún muestra confirmed → preparing
    const kitchenClient = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const session = await kitchenClient.auth.signInWithPassword({
      email: users.kitchenA.email,
      password: PASSWORD,
    });
    const authed = createClient(LOCAL_URL, LOCAL_ANON, {
      global: { headers: { Authorization: `Bearer ${session.data.session!.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await authed.from("orders").update({ status: "preparing" }).eq("id", order.id).eq("status", "confirmed");

    await card.getByRole("button", { name: "Preparar" }).click();
    await expect(page.getByText("El pedido ya cambió de estado", { exact: false })).toBeVisible();
    expect(psql(`select status from public.orders where id = '${order.id}'`)).toBe("preparing");
  });

  test("payment_status no se falsifica desde la UI operativa", async ({ page }) => {
    const order = await createOrder(BRANCH_A);
    await login(page, users.cashierA.email);
    await expect(orderInQueue(page, order.orderNumber)).toContainText(/pago pending/i);
    await orderInQueue(page, order.orderNumber).getByRole("button", { name: "Confirmar" }).click();
    await page.reload();
    expect(psql(`select payment_status from public.orders where id = '${order.id}'`)).toBe("pending");
    await expect(orderInQueue(page, order.orderNumber)).toContainText(/pago pending/i);
  });
});
