/**
 * Integración local 11B-5: membresías/menús/pedidos pensionados vía RPC + repository.
 * Requiere Supabase local; service_role solo para crear Auth users; sin service_role en app path.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getLocalSupabaseServerEnv } from "../helpers/local-supabase-env";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  url: LOCAL_URL,
  anonKey: LOCAL_ANON,
  publishableKey: LOCAL_PUBLISHABLE,
  serviceRoleKey: LOCAL_SERVICE,
  testPassword: LOCAL_TEST_PASSWORD,
} = getLocalSupabaseServerEnv();

const PREFIX = "e11b5";
const RESTAURANT_ID = "51111111-1111-4111-8111-111111111101";
const BRANCH_ID = "51111111-1111-4111-8111-111111111102";
const PLAN_ID = "51111111-1111-4111-8111-111111111201";
const ITEM_INCLUDED = `${PREFIX}-included`;
const ITEM_SUB = `${PREFIX}-sub`;
const ITEM_STD = `${PREFIX}-std`;
const PASSWORD = LOCAL_TEST_PASSWORD;

type Actor = { id: string; email: string };

const actors: {
  owner: Actor;
  admin: Actor;
  manager: Actor;
  customerA: Actor;
  customerB: Actor;
  customerCross: Actor;
} = {
  owner: { id: "", email: "" },
  admin: { id: "", email: "" },
  manager: { id: "", email: "" },
  customerA: { id: "", email: "" },
  customerB: { id: "", email: "" },
  customerCross: { id: "", email: "" },
};

let commercialDate = "";
let membershipA = "";
let membershipB = "";
let lunchMenuId = "";
let dinnerMenuId = "";
let lunchIncludedPmi = "";
let lunchSubPmi = "";
let dinnerIncludedPmi = "";
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
    delete from public.menu_items where id in ('${ITEM_INCLUDED}', '${ITEM_SUB}', '${ITEM_STD}');
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
    values ('${RESTAURANT_ID}', 'Pension 11B5', '${PREFIX}-rest', 'active', 0.0800, 0, 20, 'PN');

    -- pension_delivery_fee starts null; set later via RPC
    insert into public.branches (
      id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled,
      delivery_fee, delivery_minimum, pension_delivery_fee
    ) values (
      '${BRANCH_ID}', '${RESTAURANT_ID}', 'Centro 11B5', 'centro', 'active', true, true,
      6000, 25000, null
    );

    insert into public.categories (restaurant_id, name, slug, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Cat', '${PREFIX}-cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path
    ) values
      ('${ITEM_INCLUDED}', '${RESTAURANT_ID}', '${PREFIX}-cat', '${ITEM_INCLUDED}', 'Incluido 11B5', 'ok', 20000, true, true, 1, '/icon.svg'),
      ('${ITEM_SUB}', '${RESTAURANT_ID}', '${PREFIX}-cat', '${ITEM_SUB}', 'Sustitucion 11B5', 'ok', 45000, true, false, 2, '/icon.svg'),
      ('${ITEM_STD}', '${RESTAURANT_ID}', '${PREFIX}-cat', '${ITEM_STD}', 'Standard 11B5', 'ok', 15000, true, false, 3, '/icon.svg');

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
      ('${BRANCH_ID}', '${ITEM_INCLUDED}', 20000, true),
      ('${BRANCH_ID}', '${ITEM_SUB}', 45000, true),
      ('${BRANCH_ID}', '${ITEM_STD}', 15000, true);

    insert into public.pension_plans (id, name, public_price, modality, duration_days, included_periods, is_active)
    values ('${PLAN_ID}', 'Calendario 11B5', 300000, 'calendar_period', 30, array['lunch','dinner']::text[], true);
  `);

  commercialDate = psql(`select private.branch_commercial_date('${BRANCH_ID}')::text`);
}

async function createActor(
  admin: SupabaseClient,
  key: keyof typeof actors,
  role: string,
  withBranch: boolean,
) {
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
  if (role === "customer") {
    psql(`update public.profiles set role = 'customer', staff_status = null, name = '${key}' where id = '${id}'`);
  } else {
    psql(`
      update public.profiles
      set role = '${role}', staff_status = 'active', name = '${key}'
      where id = '${id}';
      ${withBranch ? `insert into public.staff_branch_permissions (profile_id, branch_id) values ('${id}', '${BRANCH_ID}') on conflict do nothing;` : ""}
    `);
  }
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

async function withAuthedRepo<T>(email: string, run: () => Promise<T>): Promise<T> {
  activeClient = await clientAs(email);
  try {
    return await run();
  } finally {
    activeClient = null;
  }
}

function uuid(): string {
  return crypto.randomUUID();
}

describe("11B-5 pension web → Supabase (integración local)", () => {
  beforeAll(async () => {
    try {
      psql("select 1");
    } catch {
      throw new Error("Supabase local no disponible para integración pension 11B-5.");
    }

    process.env.DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL_PUBLISHABLE;
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
    await createActor(admin, "owner", "owner", true);
    await createActor(admin, "admin", "admin", true);
    await createActor(admin, "manager", "manager", true);
    await createActor(admin, "customerA", "customer", false);
    await createActor(admin, "customerB", "customer", false);
    await createActor(admin, "customerCross", "customer", false);
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

  it("A. owner create_and_activate → active, ends_at = starts+29, agreed_price; customer role unchanged", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    membershipA = await withAuthedRepo(actors.owner.email, () =>
      new SupabasePensionRepository().createAndActivateMembership({
        customerId: actors.customerA.id,
        planId: PLAN_ID,
        branchId: BRANCH_ID,
        agreedPrice: 240000,
        paymentMethod: "cash",
        paymentDate: commercialDate,
        startsAt: commercialDate,
        mealLimit: null,
        allowSurcharge: true,
        reason: "Activacion presencial owner 11B5",
        idempotencyKey: uuid(),
      }),
    );

    const status = psql(
      `select status || '|' || ends_at::text || '|' || agreed_price::text from public.pension_memberships where id = '${membershipA}'`,
    );
    const expectedEnds = psql(`select ('${commercialDate}'::date + 29)::text`);
    expect(status).toBe(`active|${expectedEnds}|240000`);

    const role = psql(`select role from public.profiles where id = '${actors.customerA.id}'`);
    expect(role).toBe("customer");
  });

  it("B. admin activate another customer", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    membershipB = await withAuthedRepo(actors.admin.email, () =>
      new SupabasePensionRepository().createAndActivateMembership({
        customerId: actors.customerB.id,
        planId: PLAN_ID,
        branchId: BRANCH_ID,
        agreedPrice: 245000,
        paymentMethod: "cash",
        paymentDate: commercialDate,
        startsAt: commercialDate,
        mealLimit: null,
        allowSurcharge: true,
        reason: "Activacion presencial admin 11B5",
        idempotencyKey: uuid(),
      }),
    );
    const status = psql(`select status from public.pension_memberships where id = '${membershipB}'`);
    expect(status).toBe("active");
  });

  it("C. manager cannot activate (forbidden)", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    type PensionErr = import("@/server/pension/errors").PensionPersistenceError;
    await expect(
      withAuthedRepo(actors.manager.email, () =>
        new SupabasePensionRepository().createAndActivateMembership({
          customerId: actors.customerCross.id,
          planId: PLAN_ID,
          branchId: BRANCH_ID,
          agreedPrice: 200000,
          paymentMethod: "cash",
          paymentDate: commercialDate,
          startsAt: commercialDate,
          mealLimit: null,
          allowSurcharge: false,
          reason: "Manager blocked 11B5",
          idempotencyKey: uuid(),
        }),
      ),
    ).rejects.toMatchObject({
      name: "PensionPersistenceError",
      code: "forbidden",
    } satisfies Partial<PensionErr>);
  });

  it("D. save draft lunch + upsert included/sub + publish; dinner publish", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    const repo = new SupabasePensionRepository();

    lunchMenuId = await withAuthedRepo(actors.owner.email, () =>
      repo.saveMenuDraft({
        branchId: BRANCH_ID,
        serviceDate: commercialDate,
        period: "lunch",
        note: "Almuerzo 11B5",
        idempotencyKey: uuid(),
      }),
    );

    lunchIncludedPmi = await withAuthedRepo(actors.owner.email, () =>
      repo.upsertMenuItem({
        menuId: lunchMenuId,
        category: "main",
        categoryLabel: "Principal",
        isRequired: true,
        maxSelections: 1,
        menuItemId: ITEM_INCLUDED,
        isIncluded: true,
        surchargeAmount: 0,
        isAvailable: true,
        displayOrder: 1,
      }),
    );

    lunchSubPmi = await withAuthedRepo(actors.owner.email, () =>
      repo.upsertMenuItem({
        menuId: lunchMenuId,
        category: "main",
        categoryLabel: "Principal",
        isRequired: true,
        maxSelections: 1,
        menuItemId: ITEM_SUB,
        isIncluded: false,
        surchargeAmount: 3000,
        isAvailable: true,
        displayOrder: 2,
      }),
    );

    await withAuthedRepo(actors.owner.email, () =>
      repo.publishMenu({
        menuId: lunchMenuId,
        expectedStatus: "draft",
        idempotencyKey: uuid(),
      }),
    );

    dinnerMenuId = await withAuthedRepo(actors.owner.email, () =>
      repo.saveMenuDraft({
        branchId: BRANCH_ID,
        serviceDate: commercialDate,
        period: "dinner",
        note: "Cena 11B5",
        idempotencyKey: uuid(),
      }),
    );

    dinnerIncludedPmi = await withAuthedRepo(actors.owner.email, () =>
      repo.upsertMenuItem({
        menuId: dinnerMenuId,
        category: "main",
        categoryLabel: "Principal",
        isRequired: true,
        maxSelections: 1,
        menuItemId: ITEM_INCLUDED,
        isIncluded: true,
        surchargeAmount: 0,
        isAvailable: true,
        displayOrder: 1,
      }),
    );

    await withAuthedRepo(actors.owner.email, () =>
      repo.publishMenu({
        menuId: dinnerMenuId,
        expectedStatus: "draft",
        idempotencyKey: uuid(),
      }),
    );

    const lunchStatus = psql(`select status from public.pension_menus where id = '${lunchMenuId}'`);
    const dinnerStatus = psql(`select status from public.pension_menus where id = '${dinnerMenuId}'`);
    expect(lunchStatus).toBe("published");
    expect(dinnerStatus).toBe("published");
    expect(lunchIncludedPmi).toBeTruthy();
    expect(lunchSubPmi).toBeTruthy();
    expect(dinnerIncludedPmi).toBeTruthy();
  });

  it("E. customer createPensionOrder included → total DB, order_kind=pension, consumption, payment pending", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    const result = await withAuthedRepo(actors.customerA.email, () =>
      new SupabasePensionRepository().createPensionOrder({
        idempotencyKey: uuid(),
        menuId: lunchMenuId,
        pensionMenuItemIds: [lunchIncludedPmi],
        fulfillmentType: "pickup",
        customerName: "Customer A",
        customerPhone: "3001112233",
        customerEmail: actors.customerA.email,
      }),
    );

    expect(result.paymentStatus).toBe("pending");
    expect(result.replay).toBe(false);
    expect(result.total).toBe(0);

    const row = psql(
      `select order_kind || '|' || payment_status || '|' || total::text from public.orders where id = '${result.orderId}'`,
    );
    expect(row).toBe("pension|pending|0");

    const consumptions = psql(
      `select count(*)::text from public.pension_consumptions where order_id = '${result.orderId}' and status = 'confirmed'`,
    );
    expect(consumptions).toBe("1");
    expect(result.consumptionId).toBeTruthy();
  });

  it("F. substitution item → higher total reflecting DB surcharge", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    // Customer B uses lunch menu with substitution surcharge (included path used by A).
    const result = await withAuthedRepo(actors.customerB.email, () =>
      new SupabasePensionRepository().createPensionOrder({
        idempotencyKey: uuid(),
        menuId: lunchMenuId,
        pensionMenuItemIds: [lunchSubPmi],
        fulfillmentType: "pickup",
        customerName: "Customer B",
        customerPhone: "3002223344",
        customerEmail: actors.customerB.email,
      }),
    );

    // Tax 8% of 3000 surcharge = 240 → total 3240 (pickup, no delivery fee).
    expect(result.total).toBe(3240);
    expect(result.total).toBeGreaterThan(0);
    const subtotal = psql(`select subtotal::text from public.orders where id = '${result.orderId}'`);
    expect(subtotal).toBe("3000");
  });

  it("G. set delivery fee then delivery order total > pickup", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    const feeBefore = psql(
      `select coalesce(pension_delivery_fee::text, 'null') from public.branches where id = '${BRANCH_ID}'`,
    );
    expect(feeBefore).toBe("null");

    await withAuthedRepo(actors.owner.email, () =>
      new SupabasePensionRepository().setDeliveryFee({
        branchId: BRANCH_ID,
        fee: 3000,
        idempotencyKey: uuid(),
      }),
    );

    const feeAfter = psql(
      `select pension_delivery_fee::text from public.branches where id = '${BRANCH_ID}'`,
    );
    expect(feeAfter).toBe("3000");

    // Customer B already consumed lunch; use dinner for delivery vs a conceptual pickup baseline.
    // Dinner included pickup would be 0; delivery should include fee → total > 0.
    const delivery = await withAuthedRepo(actors.customerB.email, () =>
      new SupabasePensionRepository().createPensionOrder({
        idempotencyKey: uuid(),
        menuId: dinnerMenuId,
        pensionMenuItemIds: [dinnerIncludedPmi],
        fulfillmentType: "delivery",
        customerName: "Customer B",
        customerPhone: "3002223344",
        customerEmail: actors.customerB.email,
        address: {
          street: "Calle 10 # 20-30",
          neighborhood: "Centro",
        },
      }),
    );

    expect(delivery.total).toBeGreaterThan(0);
    const deliveryFee = psql(
      `select delivery_fee::text from public.orders where id = '${delivery.orderId}'`,
    );
    expect(deliveryFee).toBe("3000");
  });

  it("H. same idempotency key retry → same order_id + consumption_id, replay true", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    // Customer A dinner not yet consumed (E used lunch).
    const key = uuid();
    const first = await withAuthedRepo(actors.customerA.email, () =>
      new SupabasePensionRepository().createPensionOrder({
        idempotencyKey: key,
        menuId: dinnerMenuId,
        pensionMenuItemIds: [dinnerIncludedPmi],
        fulfillmentType: "pickup",
        customerName: "Customer A",
        customerPhone: "3001112233",
        customerEmail: actors.customerA.email,
      }),
    );
    expect(first.replay).toBe(false);

    const second = await withAuthedRepo(actors.customerA.email, () =>
      new SupabasePensionRepository().createPensionOrder({
        idempotencyKey: key,
        menuId: dinnerMenuId,
        pensionMenuItemIds: [dinnerIncludedPmi],
        fulfillmentType: "pickup",
        customerName: "Customer A",
        customerPhone: "3001112233",
        customerEmail: actors.customerA.email,
      }),
    );
    expect(second.replay).toBe(true);
    expect(second.orderId).toBe(first.orderId);
    expect(second.consumptionId).toBe(first.consumptionId);
  });

  it("I. second lunch same menu → already-consumed", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    await expect(
      withAuthedRepo(actors.customerA.email, () =>
        new SupabasePensionRepository().createPensionOrder({
          idempotencyKey: uuid(),
          menuId: lunchMenuId,
          pensionMenuItemIds: [lunchIncludedPmi],
          fulfillmentType: "pickup",
          customerName: "Customer A",
          customerPhone: "3001112233",
          customerEmail: actors.customerA.email,
        }),
      ),
    ).rejects.toMatchObject({ code: "already-consumed" });
  });

  it("J. dinner same day allowed (already placed in H; assert two consumptions for A)", async () => {
    const count = psql(
      `select count(*)::text from public.pension_consumptions
       where membership_id = '${membershipA}' and status = 'confirmed'`,
    );
    // lunch (E) + dinner (H)
    expect(count).toBe("2");
  });

  it("K. create_customer_order standard → ZERO new pension_consumptions", async () => {
    const before = psql(
      `select count(*)::text from public.pension_consumptions where membership_id = '${membershipA}'`,
    );

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
    vi.doMock("@/server/catalog/branch-config", () => ({
      requireConfiguredBranch: () => ({ id: "branch-centro", slug: "centro" }),
    }));

    const { SupabaseOrderRepository } = await import("@/server/repositories/supabase");
    activeClient = await clientAs(actors.customerA.email);
    try {
      const saved = await new SupabaseOrderRepository().saveOrder(
        {
          id: uuid(),
          orderNumber: "TEMP",
          branchId: "branch-centro",
          status: "pending",
          paymentStatus: "pending",
          paymentMethod: "demo",
          fulfillmentType: "pickup",
          items: [
            {
              itemId: ITEM_STD,
              slug: ITEM_STD,
              nameSnapshot: "Standard 11B5",
              unitPrice: 1,
              quantity: 1,
              modifiers: [],
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
          customer: {
            name: "Customer A",
            phone: "3001112233",
            email: actors.customerA.email,
          },
          notes: "",
          createdAt: new Date().toISOString(),
        },
        { tipPercent: 0 },
      );

      const kind = psql(
        `select coalesce(order_kind, 'null') from public.orders where id = '${saved.id}'`,
      );
      expect(kind === "standard" || kind === "null").toBe(true);

      const after = psql(
        `select count(*)::text from public.pension_consumptions where membership_id = '${membershipA}'`,
      );
      expect(after).toBe(before);

      const linked = psql(
        `select count(*)::text from public.pension_consumptions where order_id = '${saved.id}'`,
      );
      expect(linked).toBe("0");
    } finally {
      activeClient = null;
    }
  });

  it("L. cross-customer without membership cannot order (forbidden/membership)", async () => {
    const { SupabasePensionRepository } = await import("@/server/pension/repository");
    await expect(
      withAuthedRepo(actors.customerCross.email, () =>
        new SupabasePensionRepository().createPensionOrder({
          idempotencyKey: uuid(),
          menuId: lunchMenuId,
          pensionMenuItemIds: [lunchIncludedPmi],
          fulfillmentType: "pickup",
          customerName: "Cross",
          customerPhone: "3009998877",
          customerEmail: actors.customerCross.email,
        }),
      ),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/membership|forbidden|not-active/),
    });
  });
});
