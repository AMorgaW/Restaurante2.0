import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalSupabaseServerEnv } from "../helpers/local-supabase-env";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, skipOnboarding } from "./helpers";

/**
 * E2E dirigidos 11B-5: UI pensionado / admin pensionados contra Supabase local.
 * Requiere AUTH_MODE=supabase + DATA_MODE=supabase (playwright.pension-supabase.config.ts).
 */

const {
  url: LOCAL_URL,
  anonKey: LOCAL_ANON,
  serviceRoleKey: LOCAL_SERVICE,
  testPassword: LOCAL_TEST_PASSWORD,
} = getLocalSupabaseServerEnv();

const PREFIX = "e11b5e2e";
const RESTAURANT_ID = "61111111-1111-4111-8111-111111111101";
const BRANCH_ID = "61111111-1111-4111-8111-111111111102";
const PLAN_ID = "61111111-1111-4111-8111-111111111201";
const ITEM_INCLUDED = `${PREFIX}-included`;
const ITEM_STD = `${PREFIX}-std`;
const PASSWORD = LOCAL_TEST_PASSWORD;

const users = {
  owner: { id: "", email: "" },
  customer: { id: "", email: "" },
  customerStd: { id: "", email: "" },
};

let commercialDate = "";
let membershipId = "";
let lunchMenuId = "";
let dinnerMenuId = "";
let lunchIncludedPmi = "";
let dinnerIncludedPmi = "";

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
    delete from public.audit_log where branch_id = '${BRANCH_ID}';
    delete from public.audit_log where branch_id in (
      select id from public.branches where slug = 'centro' and id <> '${BRANCH_ID}'
    );
    delete from public.pension_consumption_selections
      where consumption_id in (
        select id from public.pension_consumptions
        where membership_id in (
          select id from public.pension_memberships where branch_id = '${BRANCH_ID}'
        )
      );
    delete from public.pension_consumptions
      where membership_id in (
        select id from public.pension_memberships where branch_id = '${BRANCH_ID}'
      );
    delete from public.order_items where order_id in (
      select id from public.orders where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro')
    );
    delete from public.orders where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.pension_menu_items where menu_category_id in (
      select c.id from public.pension_menu_categories c
      join public.pension_menus m on m.id = c.menu_id
      where m.branch_id = '${BRANCH_ID}'
         or m.branch_id in (select id from public.branches where slug = 'centro')
    );
    delete from public.pension_menu_categories where menu_id in (
      select id from public.pension_menus
      where branch_id = '${BRANCH_ID}'
         or branch_id in (select id from public.branches where slug = 'centro')
    );
    delete from public.pension_menus where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.pension_membership_transitions where membership_id in (
      select id from public.pension_memberships
      where branch_id = '${BRANCH_ID}'
         or branch_id in (select id from public.branches where slug = 'centro')
    );
    delete from public.pension_membership_cycles where membership_id in (
      select id from public.pension_memberships
      where branch_id = '${BRANCH_ID}'
         or branch_id in (select id from public.branches where slug = 'centro')
    );
    delete from public.pension_memberships where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.pension_plans where id = '${PLAN_ID}';
    delete from public.branch_menu_items where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.menu_items where id in ('${ITEM_INCLUDED}', '${ITEM_STD}');
    delete from public.categories where slug = '${PREFIX}-cat';
    delete from public.staff_branch_permissions where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.opening_hours where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.special_hours where branch_id = '${BRANCH_ID}'
      or branch_id in (select id from public.branches where slug = 'centro');
    delete from public.branches where id = '${BRANCH_ID}' or slug = 'centro';
    delete from public.restaurants where id = '${RESTAURANT_ID}';
    set session_replication_role = DEFAULT;

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'Pension E2E 11B5', '${PREFIX}-rest', 'active', 0.0800, 0, 20, 'PN');

    insert into public.branches (
      id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled,
      delivery_fee, delivery_minimum, pension_delivery_fee
    ) values (
      '${BRANCH_ID}', '${RESTAURANT_ID}', 'Centro E2E Pension', 'centro', 'active', true, true,
      6000, 25000, 3000
    );

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', '${PREFIX}-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values
      ('${ITEM_INCLUDED}', '${RESTAURANT_ID}', '${PREFIX}-cat', '${ITEM_INCLUDED}', 'Incluido E2E Pension', 'ok', 20000, true, true, 1, '/icon.svg'),
      ('${ITEM_STD}', '${RESTAURANT_ID}', '${PREFIX}-cat', '${ITEM_STD}', 'Standard E2E Pension', 'ok', 15000, true, false, 2, '/icon.svg');

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
      ('${BRANCH_ID}', '${ITEM_INCLUDED}', 20000, true),
      ('${BRANCH_ID}', '${ITEM_STD}', 15000, true);

    insert into public.pension_plans (id, name, public_price, modality, duration_days, included_periods, is_active)
    values ('${PLAN_ID}', 'Calendario E2E 11B5', 300000, 'calendar_period', 30, array['lunch','dinner']::text[], true);
  `);

  commercialDate = psql(`select private.branch_commercial_date('${BRANCH_ID}')::text`);
}

async function createUser(
  admin: SupabaseClient,
  key: keyof typeof users,
  role: string,
) {
  const email = `${PREFIX}-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? `create ${key}`);
  }
  const id = created.data.user.id;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (psql(`select count(*)::text from public.profiles where id = '${id}'`) === "1") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (role === "owner") {
    psql(`
      update public.profiles
      set role = 'owner', staff_status = 'active', name = 'Owner E2E Pension'
      where id = '${id}';
      insert into public.staff_branch_permissions (profile_id, branch_id)
      values ('${id}', '${BRANCH_ID}') on conflict do nothing;
    `);
  } else {
    psql(`
      update public.profiles
      set role = 'customer', staff_status = null, name = 'Customer E2E Pension'
      where id = '${id}';
    `);
  }
  users[key] = { id, email };
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

async function seedPensionDomain() {
  const owner = await clientAs(users.owner.email);

  const { data: membership, error: membershipError } = await owner.rpc(
    "create_and_activate_pension_membership",
    {
      target_customer: users.customer.id,
      target_plan: PLAN_ID,
      target_branch: BRANCH_ID,
      target_agreed_price: 240000,
      target_payment_method: "cash",
      target_payment_reference: "",
      target_payment_date: commercialDate,
      target_starts_at: commercialDate,
      target_meal_limit: 0,
      target_allow_surcharge: true,
      target_reason: "E2E activacion presencial",
      target_idempotency_key: crypto.randomUUID(),
    },
  );
  if (membershipError || typeof membership !== "string") {
    throw new Error(membershipError?.message ?? "membership seed failed");
  }
  membershipId = membership;

  const { data: lunch, error: lunchError } = await owner.rpc("save_pension_menu_draft", {
    target_branch: BRANCH_ID,
    target_service_date: commercialDate,
    target_period: "lunch",
    target_note: "Almuerzo E2E",
    target_idempotency_key: crypto.randomUUID(),
  });
  if (lunchError || typeof lunch !== "string") {
    throw new Error(lunchError?.message ?? "lunch draft failed");
  }
  lunchMenuId = lunch;

  const { data: lunchPmi, error: lunchPmiError } = await owner.rpc("upsert_pension_menu_item", {
    target_menu: lunchMenuId,
    target_category: "main",
    target_category_label: "Principal",
    target_is_required: true,
    target_max_selections: 1,
    target_menu_item_id: ITEM_INCLUDED,
    target_is_included: true,
    target_surcharge_amount: 0,
    target_is_available: true,
    target_display_order: 1,
  });
  if (lunchPmiError || typeof lunchPmi !== "string") {
    throw new Error(lunchPmiError?.message ?? "lunch item failed");
  }
  lunchIncludedPmi = lunchPmi;

  const { error: publishLunchError } = await owner.rpc("publish_pension_menu", {
    target_menu: lunchMenuId,
    expected_status: "draft",
    target_idempotency_key: crypto.randomUUID(),
  });
  if (publishLunchError) throw new Error(publishLunchError.message);

  const { data: dinner, error: dinnerError } = await owner.rpc("save_pension_menu_draft", {
    target_branch: BRANCH_ID,
    target_service_date: commercialDate,
    target_period: "dinner",
    target_note: "Cena E2E",
    target_idempotency_key: crypto.randomUUID(),
  });
  if (dinnerError || typeof dinner !== "string") {
    throw new Error(dinnerError?.message ?? "dinner draft failed");
  }
  dinnerMenuId = dinner;

  const { data: dinnerPmi, error: dinnerPmiError } = await owner.rpc("upsert_pension_menu_item", {
    target_menu: dinnerMenuId,
    target_category: "main",
    target_category_label: "Principal",
    target_is_required: true,
    target_max_selections: 1,
    target_menu_item_id: ITEM_INCLUDED,
    target_is_included: true,
    target_surcharge_amount: 0,
    target_is_available: true,
    target_display_order: 1,
  });
  if (dinnerPmiError || typeof dinnerPmi !== "string") {
    throw new Error(dinnerPmiError?.message ?? "dinner item failed");
  }
  dinnerIncludedPmi = dinnerPmi;

  const { error: publishDinnerError } = await owner.rpc("publish_pension_menu", {
    target_menu: dinnerMenuId,
    expected_status: "draft",
    target_idempotency_key: crypto.randomUUID(),
  });
  if (publishDinnerError) throw new Error(publishDinnerError.message);

  void lunchIncludedPmi;
  void dinnerIncludedPmi;
}

async function login(page: Page, email: string, destination: RegExp, nextPath?: string) {
  if (!email) throw new Error("login: email vacío (seed incompleto)");
  await page.context().clearCookies();
  await skipOnboarding(page);
  const loginUrl = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  await page.goto(loginUrl);
  await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  await page.getByLabel(/Correo electr/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  try {
    await page.waitForURL(destination, { timeout: 45_000 });
  } catch (error) {
    const alert = await page.getByRole("alert").textContent().catch(() => null);
    const url = page.url();
    throw new Error(
      `Login no llegó a ${destination}. url=${url} email=${email} alert=${alert ?? "(sin alert)"}`,
      { cause: error },
    );
  }
  await page.waitForLoadState("networkidle");
}

async function logout(page: Page) {
  const signOut = page.getByRole("button", { name: /Cerrar sesión|Salir/i }).first();
  if (await signOut.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL(/\/(login)?(\?|$)/, { timeout: 30_000 }).catch(() => undefined),
      signOut.click(),
    ]);
  }
  await page.context().clearCookies();
}

let seededForProject: string | null = null;
const createdUserIds: string[] = [];

async function ensureSeed(projectName: string) {
  if (seededForProject === projectName) return;

  // Cleanup previous project fixtures (same worker runs Chromium then WebKit).
  if (createdUserIds.length > 0) {
    const ids = createdUserIds.map((id) => `'${id}'`).join(",");
    try {
      seedCatalog();
      psql(`
        delete from public.staff_branch_permissions where profile_id in (${ids});
        delete from public.profiles where id in (${ids});
        delete from auth.users where id in (${ids});
      `);
    } catch {
      // best-effort
    }
    createdUserIds.length = 0;
  }

  seedCatalog();
  const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await createUser(admin, "owner", "owner");
  await createUser(admin, "customer", "customer");
  await createUser(admin, "customerStd", "customer");
  createdUserIds.push(users.owner.id, users.customer.id, users.customerStd.id);
  await seedPensionDomain();
  seededForProject = projectName;
}

test.beforeAll(async () => {
  try {
    psql("select 1");
  } catch {
    throw new Error("Supabase local no disponible para E2E pension.");
  }
});

test.beforeEach(async ({}, testInfo) => {
  await ensureSeed(testInfo.project.name);
});

test.afterAll(() => {
  try {
    const ids = createdUserIds.map((id) => `'${id}'`).join(",");
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

test.describe.configure({ mode: "serial" });

test.describe("Pension Supabase local (11B-5)", () => {
  test("1. owner login → /admin/pensionados visible", async ({ page }) => {
    await login(page, users.owner.email, /\/admin\/pensionados/, "/admin/pensionados");
    await expect(page.getByRole("heading", { name: "Pensionados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Crear y activar membresía/i })).toBeVisible();
  });

  test("2. membresía seeded visible para owner", async ({ page }) => {
    await login(page, users.owner.email, /\/admin\/pensionados/, "/admin/pensionados");
    await expect(page.getByText(/Calendario E2E 11B5|Customer E2E Pension/i).first()).toBeVisible();
    await expect(page.getByText(commercialDate).first()).toBeVisible();
    const status = psql(`select status from public.pension_memberships where id = '${membershipId}'`);
    expect(status).toBe("active");
  });

  test("3–5. customer ve vigencia, menús y crea pedido incluido", async ({ page }) => {
    const memberCheck = psql(
      `select status || ':' || profile_id::text from public.pension_memberships where id = '${membershipId}'`,
    );
    expect(memberCheck).toBe(`active:${users.customer.id}`);

    await login(page, users.customer.email, /\/pensionado(\/|$|\?)/);
    await expect(page.getByRole("heading", { name: /Calendario E2E 11B5/i }).first()).toBeVisible();

    const endsAt = psql(
      `select ends_at::text from public.pension_memberships where id = '${membershipId}'`,
    );
    await expect(page.getByText(new RegExp(`${commercialDate}`)).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`${endsAt}`)).first()).toBeVisible();

    await expect(page.getByRole("button", { name: /Almuerzo/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cena/i })).toBeVisible();
    await expect(page.getByText(/Incluido E2E Pension/i).first()).toBeVisible();

    await page.getByRole("button", { name: /Almuerzo/i }).click();
    await page.getByLabel(/Incluido E2E Pension/i).check();
    await page.locator('input[name="pension-fulfillment"][value="pickup"]').check({ force: true });
    await page.getByLabel(/^Nombre$/i).fill("Pension Customer");
    await page.getByLabel(/^Teléfono$/i).fill("3001112233");
    await page.getByLabel(/^Correo$/i).fill(users.customer.email);

    const confirm = page.getByRole("button", { name: /Confirmar pedido pensionado/i });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText(/Pedido PN-/i).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/pago (pending|pendiente)/i).first()).toBeVisible();

    // Retry same attempt (idempotency): button may be disabled after success; assert DB exactly-once.
    const consumptions = psql(
      `select count(*)::text from public.pension_consumptions
       where membership_id = '${membershipId}' and menu_id = '${lunchMenuId}' and status = 'confirmed'`,
    );
    expect(consumptions).toBe("1");
  });

  test("6–7. no segundo consumo; segundo almuerzo rechazado", async ({ page }) => {
    const before = psql(
      `select count(*)::text from public.pension_consumptions
       where membership_id = '${membershipId}' and menu_id = '${lunchMenuId}' and status = 'confirmed'`,
    );
    expect(before).toBe("1");

    await login(page, users.customer.email, /\/pensionado(\/|$|\?)/);
    await page.getByRole("button", { name: /Almuerzo/i }).click();
    await expect(
      page.getByText(/Ya registraste un consumo para este periodo/i),
    ).toBeVisible();

    const after = psql(
      `select count(*)::text from public.pension_consumptions
       where membership_id = '${membershipId}' and menu_id = '${lunchMenuId}' and status = 'confirmed'`,
    );
    expect(after).toBe("1");
  });

  test("8. cena permitida el mismo día", async ({ page }) => {
    await login(page, users.customer.email, /\/pensionado(\/|$|\?)/);
    await page.getByRole("button", { name: /Cena/i }).click();
    await expect(page.getByText(/Incluido E2E Pension/i).first()).toBeVisible();
    await page.getByLabel(/Incluido E2E Pension/i).check();
    await page.locator('input[name="pension-fulfillment"][value="pickup"]').check({ force: true });
    await page.getByLabel(/^Nombre$/i).fill("Pension Customer");
    await page.getByLabel(/^Teléfono$/i).fill("3001112233");
    await page.getByLabel(/^Correo$/i).fill(users.customer.email);
    await page.getByRole("button", { name: /Confirmar pedido pensionado/i }).click();
    await expect(page.getByText(/Pedido PN-/i).first()).toBeVisible({ timeout: 30_000 });

    const dinnerCount = psql(
      `select count(*)::text from public.pension_consumptions
       where membership_id = '${membershipId}' and menu_id = '${dinnerMenuId}' and status = 'confirmed'`,
    );
    expect(dinnerCount).toBe("1");
  });

  test("9. checkout standard no requiere pension", async ({ page }) => {
    await logout(page);
    await skipOnboarding(page);

    const anon = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.rpc("create_customer_order", {
      p_idempotency_key: crypto.randomUUID(),
      p_branch_id: BRANCH_ID,
      p_fulfillment_type: "pickup",
      p_customer_name: "Guest Standard",
      p_customer_phone: "3009998877",
      p_customer_email: "guest-std@test.local",
      p_items: [{ menu_item_id: ITEM_STD, quantity: 1, notes: "", modifier_option_ids: [] }],
      p_address: null,
      p_notes: null,
      p_tip_percent: 0,
      p_coupon_code: null,
    });
    expect(error).toBeNull();
    const row = (Array.isArray(data) ? data[0] : data) as { order_id: string };
    const kind = psql(
      `select coalesce(order_kind, 'null') from public.orders where id = '${row.order_id}'`,
    );
    expect(kind === "standard" || kind === "null").toBe(true);
    const linked = psql(
      `select count(*)::text from public.pension_consumptions where order_id = '${row.order_id}'`,
    );
    expect(linked).toBe("0");

    await page.goto("/menu");
    // Menú público no exige membresía pensionada; basta con que la ruta cargue.
    await expect(page).toHaveURL(/\/menu/);
    await expect(page.locator("main, [id='contenido'], body").first()).toBeVisible();
  });

  test("10. viewport móvil usable", async ({ page }) => {
    await login(page, users.customer.email, /\/pensionado(\/|$|\?)/);
    await expect(page.getByRole("heading", { name: /Calendario E2E 11B5|Arma tu comida/i }).first()).toBeVisible();
    const noOverflow = await expectNoHorizontalScroll(page);
    expect(noOverflow).toBe(true);
  });
});
