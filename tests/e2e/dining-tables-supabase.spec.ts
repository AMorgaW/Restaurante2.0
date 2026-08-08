import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { skipOnboarding } from "./helpers";

/**
 * E2E dirigidos 11B-6: mesas + cobros manuales (Supabase Auth/Data).
 * Requiere AUTH_MODE=supabase + DATA_MODE=supabase (playwright.dining-tables-supabase.config.ts).
 */

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON =
  "[REDACTED_LOCAL_KEY]";
const LOCAL_SERVICE =
  "[REDACTED_LOCAL_SERVICE_ROLE]";

const RESTAURANT_ID = "71111111-1111-4111-8111-111111111101";
const BRANCH_A = "71111111-1111-4111-8111-111111111102";
const ITEM_ID = "e11b6e2e-plato";
const GROUP_ID = "e11b6e2e-group";
const OPTION_ID = "e11b6e2e-option";
const PASSWORD = "[REDACTED_LOCAL_PASSWORD]";

const users = {
  owner: { id: "", email: "" },
  cashier: { id: "", email: "" },
  manager: { id: "", email: "" },
};

type TableFixture = {
  tableId: string;
  qrToken: string;
  code: string;
  sessionId: string;
};

let tableFixture: TableFixture = {
  tableId: "",
  qrToken: "",
  code: "1",
  sessionId: "",
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

function cleanupBranchData() {
  psql(`
    set session_replication_role = replica;
    delete from public.manual_payment_voids
      where confirmation_id in (
        select id from public.manual_payment_confirmations
        where branch_id = '${BRANCH_A}'
           or target_table_session_id in (
             select id from public.table_sessions where branch_id = '${BRANCH_A}'
           )
           or target_order_id in (
             select id from public.orders where branch_id = '${BRANCH_A}'
           )
      );
    delete from public.manual_payment_allocations
      where confirmation_id in (
        select id from public.manual_payment_confirmations
        where branch_id = '${BRANCH_A}'
           or target_table_session_id in (
             select id from public.table_sessions where branch_id = '${BRANCH_A}'
           )
           or target_order_id in (
             select id from public.orders where branch_id = '${BRANCH_A}'
           )
      );
    delete from public.manual_payment_confirmations
      where branch_id = '${BRANCH_A}'
         or target_table_session_id in (
           select id from public.table_sessions where branch_id = '${BRANCH_A}'
         )
         or target_order_id in (
           select id from public.orders where branch_id = '${BRANCH_A}'
         );
    delete from public.order_items where order_id in (
      select id from public.orders where branch_id = '${BRANCH_A}'
    );
    delete from public.orders where branch_id = '${BRANCH_A}';
    delete from public.table_sessions where branch_id = '${BRANCH_A}';
    delete from public.dining_tables where branch_id = '${BRANCH_A}';
    delete from public.audit_log where branch_id = '${BRANCH_A}';
    set session_replication_role = DEFAULT;
  `);
}

function seed() {
  cleanupBranchData();
  psql(`
    delete from public.modifier_options where id = '${OPTION_ID}';
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
    delete from public.menu_items where id = '${ITEM_ID}';
    delete from public.categories where slug = 'e11b6e2e-cat';
    delete from public.staff_branch_permissions where branch_id = '${BRANCH_A}';
    delete from public.opening_hours where branch_id = '${BRANCH_A}';
    delete from public.special_hours where branch_id = '${BRANCH_A}';
    delete from public.branches where id = '${BRANCH_A}';
    delete from public.branches where slug = 'centro' and id <> '${BRANCH_A}';
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'E2E 11B6', 'e11b6e2e-rest', 'active', 0.0800, 0, 20, 'CB');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values ('${BRANCH_A}', '${RESTAURANT_ID}', 'Centro E2E', 'centro', 'active', true, true, 6000, 25000);

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', 'e11b6e2e-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values (
      '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b6e2e-cat', '${ITEM_ID}', 'Plato E2E 11B6', 'ok', 20000,
      true, true, 1, '/icon.svg'
    );

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
    values ('${BRANCH_A}', '${ITEM_ID}', 22000, true);

    insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
    values ('${GROUP_ID}', '${ITEM_ID}', 'Extra', 1, 1, true, 1);

    insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order)
    values ('${OPTION_ID}', '${GROUP_ID}', 'Guacamole', 2000, true, 1);
  `);
}

async function createStaff(
  admin: {
    auth: {
      admin: {
        createUser: (args: {
          email: string;
          password: string;
          email_confirm: boolean;
        }) => Promise<{ data: { user: { id: string } | null }; error: { message?: string } | null }>;
      };
    };
  },
  key: keyof typeof users,
  role: string,
) {
  const email = `e2e-11b6-${key}-${Date.now()}@test.local`;
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "create user");
  }
  const id = created.data.user.id;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const exists = psql(`select count(*)::text from public.profiles where id = '${id}'`);
    if (exists === "1") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  psql(`
    update public.profiles
    set role = '${role}',
        staff_status = 'active',
        name = '${role} E2E 11B6'
    where id = '${id}';
    delete from public.staff_branch_permissions where profile_id = '${id}';
    insert into public.staff_branch_permissions (profile_id, branch_id)
    values ('${id}', '${BRANCH_A}');
  `);

  const verified = psql(
    `select role || ':' || coalesce(staff_status, 'null') from public.profiles where id = '${id}'`,
  );
  if (verified !== `${role}:active`) {
    throw new Error(`No se pudo promover ${key}: got ${verified}`);
  }
  users[key] = { id, email };
}

async function createDiningTableAsOwner(): Promise<TableFixture> {
  const client = createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signError } = await client.auth.signInWithPassword({
    email: users.owner.email,
    password: PASSWORD,
  });
  if (signError) throw new Error(signError.message);

  const { data, error } = await client.rpc("create_dining_table", {
    p_branch_id: BRANCH_A,
    p_code: "1",
    p_name: "Mesa 1",
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as {
    table_id: string;
    code: string;
    qr_token: string;
  };

  const { data: resolved, error: resolveError } = await client.rpc("resolve_table_qr", {
    p_qr_token: row.qr_token,
  });
  if (resolveError) throw new Error(resolveError.message);
  const session = resolved as { session_id: string };

  return {
    tableId: row.table_id,
    qrToken: row.qr_token,
    code: row.code,
    sessionId: session.session_id,
  };
}

async function createLocalOrder(qrToken: string): Promise<{ id: string; orderNumber: string }> {
  const anon = createClient(LOCAL_URL, LOCAL_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("create_customer_order", {
    p_idempotency_key: crypto.randomUUID(),
    p_branch_id: BRANCH_A,
    p_fulfillment_type: "local",
    p_customer_name: "Cliente Mesa E2E",
    p_customer_phone: "3009998877",
    p_customer_email: "mesa-e2e@test.local",
    p_items: [
      {
        menu_item_id: ITEM_ID,
        quantity: 1,
        notes: "",
        modifier_option_ids: [OPTION_ID],
      },
    ],
    p_address: null,
    p_notes: "pedido mesa e2e",
    p_tip_percent: 0,
    p_coupon_code: null,
    p_table_qr_token: qrToken,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as {
    order_id: string;
    order_number: string;
  };
  return { id: row.order_id, orderNumber: row.order_number };
}

async function login(page: Page, email: string, expectedPath: RegExp) {
  if (!email) throw new Error("login: email vacío (seed incompleto)");
  await page.context().clearCookies();
  await skipOnboarding(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Iniciar sesión/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  await page.getByLabel(/Correo electr/i).fill(email);
  await page.getByLabel(/^Contraseña$/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  try {
    await page.waitForURL(expectedPath, { timeout: 45_000 });
  } catch (error) {
    const alert = await page.getByRole("alert").textContent().catch(() => null);
    throw new Error(
      `Login no llegó a ${expectedPath}. url=${page.url()} email=${email} alert=${alert ?? "(sin alert)"}`,
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
  await page.evaluate(() => {
    window.localStorage.clear();
    // Conserva contexto de mesa solo si hace falta; en cambio de rol lo limpiamos.
    window.sessionStorage.clear();
  });
}

/** Guest: landing QR establece contexto; pedido vía RPC (misma session DB). */
async function openMesaAsGuest(page: Page, qrToken: string) {
  await page.context().clearCookies();
  await skipOnboarding(page);
  await page.goto(`/mesa/${qrToken}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Estás en Mesa 1/i })).toBeVisible({
    timeout: 45_000,
  });
  await expect
    .poll(async () =>
      page.evaluate(() => Boolean(window.sessionStorage.getItem("rb-table-context"))),
    )
    .toBe(true);
  await expect(page.getByRole("link", { name: "Ver menú" })).toBeVisible();
  await page.goto("/menu", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/menu/);
}

/** Checkout vía API web (misma ruta que el formulario) con token de mesa. */
async function placeLocalOrderViaApi(
  request: import("@playwright/test").APIRequestContext,
  qrToken: string,
): Promise<string> {
  const response = await request.post("/api/orders", {
    data: {
      idempotencyKey: crypto.randomUUID(),
      branchId: "branch-centro",
      fulfillmentType: "local",
      tableQrToken: qrToken,
      customer: {
        name: "Cliente Mesa E2E",
        phone: "3009998877",
        email: "mesa-e2e@test.local",
      },
      items: [
        {
          slug: ITEM_ID,
          quantity: 1,
          notes: "",
          modifiers: [{ groupId: GROUP_ID, optionId: OPTION_ID }],
        },
      ],
      tipPercent: 0,
      notes: "pedido mesa e2e api",
    },
  });
  const body = (await response.json()) as {
    order?: { orderNumber?: string; id?: string };
    error?: string;
    code?: string;
  };
  if (!response.ok() || !body.order?.orderNumber) {
    throw new Error(
      `API local order falló: status=${response.status()} code=${body.code ?? ""} error=${body.error ?? ""}`,
    );
  }
  return body.order.orderNumber;
}

let seededForProject: string | null = null;
const createdUserIds: string[] = [];

async function ensureSeed(projectName: string) {
  if (seededForProject === projectName) return;

  if (createdUserIds.length > 0) {
    const ids = createdUserIds.map((id) => `'${id}'`).join(",");
    try {
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

  try {
    psql("select 1");
  } catch {
    throw new Error("Supabase local no disponible para E2E dining tables.");
  }
  seed();
  const admin = createClient(LOCAL_URL, LOCAL_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await createStaff(admin, "owner", "owner");
  await createStaff(admin, "cashier", "cashier");
  await createStaff(admin, "manager", "manager");
  createdUserIds.push(users.owner.id, users.cashier.id, users.manager.id);
  tableFixture = await createDiningTableAsOwner();
  seededForProject = projectName;
}

test.beforeAll(async () => {
  try {
    psql("select 1");
  } catch {
    throw new Error("Supabase local no disponible para E2E dining tables.");
  }
});

test.afterAll(() => {
  try {
    const ids = createdUserIds.map((id) => `'${id}'`).join(",");
    if (ids) {
      psql(`
        delete from public.staff_branch_permissions where profile_id in (${ids});
        delete from public.profiles where id in (${ids});
        delete from auth.users where id in (${ids});
      `);
    }
    cleanupBranchData();
  } catch {
    // best-effort
  }
});

test.describe("Dining tables / manual payments Supabase", () => {
  test("flujo dirigido: guest mesa → multi-pedido → cobro cashier → void owner", async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(180_000);
    await ensureSeed(testInfo.project.name);

    await openMesaAsGuest(page, tableFixture.qrToken);

    // Pedido A vía API web (checkout server) + B vía RPC — misma session
    const orderANumber = await placeLocalOrderViaApi(request, tableFixture.qrToken);
    const orderB = await createLocalOrder(tableFixture.qrToken);
    expect(orderB.orderNumber).toBeTruthy();
    expect(orderANumber).toBeTruthy();

    const sessionStillOpen = psql(
      `select status from public.table_sessions where id = '${tableFixture.sessionId}'`,
    );
    expect(sessionStillOpen).toBe("open");

    const sameSessionCount = psql(
      `select count(*)::text from public.orders
       where table_session_id = '${tableFixture.sessionId}'`,
    );
    expect(Number(sameSessionCount)).toBeGreaterThanOrEqual(2);

    // Listado owner
    await login(page, users.owner.email, /\/admin(\/|$|\?)/);
    await page.goto("/admin/mesas");
    await expect(page.getByRole("heading", { name: "Mesas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mesa 1" })).toBeVisible();
    await logout(page);

    // Staff open_account + cobro
    await login(page, users.cashier.email, /\/empleado(\/|$|\?)/);
    await page.goto("/empleado/mesas");
    await expect(page.getByRole("heading", { name: "Mesas" })).toBeVisible();
    const mesaCard = page.locator("li").filter({ hasText: "Mesa 1" });
    await expect(mesaCard.getByText("Cuenta abierta")).toBeVisible();
    await mesaCard.getByRole("link", { name: "Ver cuenta" }).click();
    await expect(page.getByRole("heading", { name: "Mesa 1" })).toBeVisible();
    await expect(page.getByText(orderANumber, { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(orderB.orderNumber, { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cobrar cuenta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anular cobro" })).toHaveCount(0);

    await page.getByRole("button", { name: "Efectivo" }).click();
    const status = page.getByTestId("payment-action-status");
    await expect(status).toBeVisible({ timeout: 45_000 });
    const statusText = (await status.textContent()) ?? "";
    if (!/Cobro confirmado|Cobro ya registrado/i.test(statusText)) {
      throw new Error(`Cobro UI falló: ${statusText}`);
    }
    const closedStatus = psql(
      `select status from public.table_sessions where id = '${tableFixture.sessionId}'`,
    );
    expect(closedStatus).toBe("closed");
    await page.goto(`/empleado/mesas/cuenta/${tableFixture.sessionId}`);
    await expect(page.getByText("Cerrada")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Anular cobro" })).toHaveCount(0);

    await page.goto("/empleado/mesas");
    const freeCard = page.locator("li").filter({ hasText: "Mesa 1" });
    await expect(freeCard.getByText("Libre")).toBeVisible();
    await logout(page);

    // Owner void
    await login(page, users.owner.email, /\/admin(\/|$|\?)/);
    await page.goto(`/admin/mesas/cuenta/${tableFixture.sessionId}`);
    await expect(page.getByRole("heading", { name: "Mesa 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Anular cobro" })).toBeVisible();
    await page.getByRole("button", { name: "Anular cobro" }).click();
    await page.getByLabel(/Motivo/i).fill("Error de caja E2E");
    await page.getByRole("button", { name: "Confirmar anulación" }).click();
    await expect(page.getByText(/Anulado/i).first()).toBeVisible({ timeout: 45_000 });
  });

  test("manager no gestiona mesas en admin; cashier no anula", async ({ page }, testInfo) => {
    await ensureSeed(testInfo.project.name);
    await login(page, users.manager.email, /\/empleado(\/|$|\?)/);
    await page.goto("/admin/mesas", { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await expect(page).not.toHaveURL(/\/admin\/mesas/);

    await page.goto("/empleado/mesas", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mesas" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Administrar mesas" })).toHaveCount(0);
    await logout(page);

    await login(page, users.cashier.email, /\/empleado(\/|$|\?)/);
    await page.goto(`/empleado/mesas/cuenta/${tableFixture.sessionId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("button", { name: "Anular cobro" })).toHaveCount(0);
  });
});
