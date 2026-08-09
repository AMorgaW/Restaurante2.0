import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

/**
 * E2E 11B-7: polling in-web de pedidos nuevos (staff + owner supervisión).
 */

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON =
  "[REDACTED_LOCAL_KEY]";
const LOCAL_SERVICE =
  "[REDACTED_LOCAL_SERVICE_ROLE]";

// IDs propios (no reutilizar 6111… de pension-supabase) para aislamiento entre suites.
const RESTAURANT_ID = "81111111-1111-4111-8111-111111111101";
const BRANCH_A = "81111111-1111-4111-8111-111111111102";
const BRANCH_B = "81111111-1111-4111-8111-111111111103";
const ITEM_ID = "e11b7e2e-plato";
const GROUP_ID = "e11b7e2e-group";
const OPTION_ID = "e11b7e2e-option";
const PASSWORD = "[REDACTED_LOCAL_PASSWORD]";

const users = {
  cashierA: { id: "", email: "" },
  owner: { id: "", email: "" },
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
    delete from public.order_items where menu_item_id = '${ITEM_ID}';
    delete from public.orders where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    set session_replication_role = DEFAULT;
    delete from public.modifier_options where id = '${OPTION_ID}';
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = 'e11b7e2e-cat';
    delete from public.staff_branch_permissions where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.opening_hours where branch_id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.branches where id in ('${BRANCH_A}', '${BRANCH_B}');
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'E2E 11B7', 'e11b7e2e-rest', 'active', 0.0800, 0, 20, 'AL');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values
      ('${BRANCH_A}', '${RESTAURANT_ID}', 'Centro Alerts', 'centro-alerts-11b7', 'active', true, true, 6000, 25000),
      ('${BRANCH_B}', '${RESTAURANT_ID}', 'Norte Alerts', 'norte-alerts-11b7', 'active', true, false, 0, 0);

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', 'e11b7e2e-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b7e2e-cat', '${ITEM_ID}', 'Plato E2E 11B7', 'ok', 20000,
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

async function createStaff(
  admin: { auth: { admin: { createUser: (args: { email: string; password: string; email_confirm: boolean }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> } } },
  key: keyof typeof users,
  role: string,
  branchId: string | null,
) {
  const email = `e2e-11b7-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`create ${key}: ${created.error?.message}`);
  }
  const id = created.data.user.id;
  if (role === "owner") {
    psql(`update public.profiles set role = 'owner', staff_status = 'active' where id = '${id}'`);
  } else {
    psql(`
      update public.profiles set role = '${role}', staff_status = 'active' where id = '${id}';
      insert into public.staff_branch_permissions (profile_id, branch_id) values ('${id}', '${branchId}') on conflict do nothing;
    `);
  }
  users[key] = { id, email };
}

async function createOrder(branchId: string): Promise<{ id: string; orderNumber: string }> {
  const anon = createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("create_customer_order", {
    p_idempotency_key: crypto.randomUUID(),
    p_branch_id: branchId,
    p_fulfillment_type: "pickup",
    p_customer_name: "Cliente Alerts",
    p_customer_phone: "3001112233",
    p_customer_email: "alerts-e2e@test.local",
    p_items: [{ menu_item_id: ITEM_ID, quantity: 1, notes: "", modifier_option_ids: [OPTION_ID] }],
    p_address: null,
    p_notes: null,
    p_tip_percent: 0,
    p_coupon_code: null,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: string };
  return { id: row.order_id, orderNumber: row.order_number };
}

async function login(page: Page, email: string) {
  await skipOnboarding(page);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Iniciar sesi/i })).toBeVisible({ timeout: 30_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    try {
      await page.waitForURL(/\/(empleado|admin)(\/|$|\?)/, { timeout: 60_000 });
      await page.waitForLoadState("domcontentloaded");
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(2_000);
    }
  }
}

async function triggerPoll(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  try {
    psql("select 1");
  } catch {
    throw new Error("Supabase local no disponible para E2E order alerts.");
  }
  seed();
  const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await createStaff(admin, "cashierA", "cashier", BRANCH_A);
  await createStaff(admin, "owner", "owner", null);
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

async function waitForBaseline(page: Page) {
  await expect(page.getByTestId("operational-order-alerts")).toBeVisible();
  await expect(page.getByTestId("operational-pending-count")).toBeVisible();
  // Esperar a que el primer poll complete (baseline sin tormenta de toasts).
  await expect(page.getByText(/Avisos in-web|Última actualización falló/i)).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(1_500);
}

async function waitForNewOrderSignal(page: Page, orderNumber: string) {
  const toast = page.getByText(new RegExp(`Nuevo pedido ${orderNumber}|pedidos nuevos`, "i"));
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await triggerPoll(page);
    if (await toast.isVisible().catch(() => false)) return;
    const pending = page.getByTestId("operational-pending-count");
    const text = await pending.innerText().catch(() => "");
    if (/[1-9]/.test(text) && (await page.getByText(orderNumber).count()) > 0) return;
    await page.waitForTimeout(2_000);
  }
  await expect(toast).toBeVisible({ timeout: 5_000 });
}

test.describe("Order alerts Supabase", () => {
  test("cashier: polling detecta pedido nuevo sin Actualizar manual", async ({ page }) => {
    await login(page, users.cashierA.email);
    await expect(page).toHaveURL(/\/empleado/);
    await waitForBaseline(page);

    const order = await createOrder(BRANCH_A);
    await waitForNewOrderSignal(page, order.orderNumber);

    await expect(page.getByTestId("operational-pending-count")).toContainText(/[1-9]/);
    await expect(
      page.getByLabel("Cola de pedidos").locator("article").filter({ hasText: `#${order.orderNumber}` }),
    ).toBeVisible({ timeout: 40_000 });

    await page
      .getByLabel("Cola de pedidos")
      .locator("article")
      .filter({ hasText: `#${order.orderNumber}` })
      .getByRole("button", { name: "Confirmar" })
      .click();
    await expect(page.getByText("Pedido actualizado")).toBeVisible();
    await triggerPoll(page);
    await expect
      .poll(async () => psql(`select status from public.orders where id = '${order.id}'`), { timeout: 20_000 })
      .toBe("confirmed");
  });

  test("owner: supervisión en /admin fuera de pedidos", async ({ page }) => {
    await login(page, users.owner.email);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/inventario");
    await waitForBaseline(page);

    const order = await createOrder(BRANCH_A);
    await waitForNewOrderSignal(page, order.orderNumber);
    await expect(page.getByTestId("operational-pending-count")).toContainText(/[1-9]/);

    await page.goto("/admin/pedidos");
    await expect(page.getByText(order.orderNumber)).toBeVisible({ timeout: 40_000 });
  });

  test("responsive sin overflow horizontal en shells", async ({ browser }) => {
    const cashierPage = await browser.newPage();
    await login(cashierPage, users.cashierA.email);
    expect(await expectNoHorizontalScroll(cashierPage)).toBe(true);
    await cashierPage.close();

    const ownerPage = await browser.newPage();
    await login(ownerPage, users.owner.email);
    await ownerPage.goto("/admin");
    expect(await expectNoHorizontalScroll(ownerPage)).toBe(true);
    await ownerPage.close();
  });

  test("a11y dirigida: alerts sin violaciones critical/serious", async ({ page }) => {
    await login(page, users.owner.email);
    await expect(page.getByTestId("operational-order-alerts")).toBeVisible();
    const results = await new AxeBuilder({ page }).include('[data-testid="operational-order-alerts"]').analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  });
});
