import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { skipOnboarding } from "./helpers";

/**
 * E2E dirigidos: catálogo + checkout con DATA_MODE=supabase (local).
 * Fixtures controladas; pedidos reales vía RPC local (11B-2B).
 */

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111101";
const BRANCH_ID = "11111111-1111-4111-8111-111111111102";
const OTHER_BRANCH_ID = "11111111-1111-4111-8111-111111111103";
const ITEM_ACTIVE = "e11b1a-plato-activo";
const ITEM_INACTIVE = "e11b1a-plato-inactivo";
const ITEM_UNAVAILABLE = "e11b1a-plato-no-disp";
const GROUP_ID = "e11b1a-group-extra";
const OPTION_ID = "e11b1a-option-guac";

function psql(sql: string) {
  execFileSync(
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
      "-c",
      sql,
    ],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  );
}

function seedCatalog() {
  psql(`
    delete from public.modifier_options where id in ('${OPTION_ID}');
    delete from public.modifier_groups where id = '${GROUP_ID}';
    delete from public.branch_menu_items where menu_item_id like 'e11b1a-%';
    delete from public.menu_items where id like 'e11b1a-%';
    delete from public.categories where slug = 'e11b1a-carnes';
    delete from public.branch_menu_items where branch_id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
    delete from public.opening_hours where branch_id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
    delete from public.special_hours where branch_id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
    delete from public.branches where id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
    delete from public.branches where slug in ('centro', 'norte');
    delete from public.restaurants where id = '${RESTAURANT_ID}';

    insert into public.restaurants (id, name, slug, status, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
    values ('${RESTAURANT_ID}', 'Test Catalogo E2E', 'e11b1a-rest', 'active', 0.0800, 0, 20, 'CB');

    insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum)
    values
      ('${BRANCH_ID}', '${RESTAURANT_ID}', 'Centro test', 'centro', 'active', true, true, 6000, 25000),
      ('${OTHER_BRANCH_ID}', '${RESTAURANT_ID}', 'Norte test', 'norte', 'active', true, false, 6000, 25000);

    insert into public.categories (restaurant_id, name, slug, description, display_order, is_active)
    values ('${RESTAURANT_ID}', 'Carnes test', 'e11b1a-carnes', 'Cat', 1, true);

    insert into public.menu_items (
      id, restaurant_id, category_slug, slug, name, short_description, base_price,
      available, featured, display_order, image_path, is_independently_orderable
    ) values
      ('${ITEM_ACTIVE}', '${RESTAURANT_ID}', 'e11b1a-carnes', '${ITEM_ACTIVE}', 'Plato activo E2E', 'ok', 20000, true, true, 1, '/icon.svg', true),
      ('${ITEM_INACTIVE}', '${RESTAURANT_ID}', 'e11b1a-carnes', '${ITEM_INACTIVE}', 'Plato inactivo E2E', 'off', 15000, false, false, 2, '/icon.svg', true),
      ('${ITEM_UNAVAILABLE}', '${RESTAURANT_ID}', 'e11b1a-carnes', '${ITEM_UNAVAILABLE}', 'Plato no disponible E2E', 'nd', 18000, true, false, 3, '/icon.svg', true);

    insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
      ('${BRANCH_ID}', '${ITEM_ACTIVE}', 22000, true),
      ('${BRANCH_ID}', '${ITEM_INACTIVE}', 15000, true),
      ('${BRANCH_ID}', '${ITEM_UNAVAILABLE}', 18000, false),
      ('${OTHER_BRANCH_ID}', '${ITEM_ACTIVE}', 21000, false);

    insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
    values ('${GROUP_ID}', '${ITEM_ACTIVE}', 'Extra', 1, 1, true, 1);

    insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order)
    values ('${OPTION_ID}', '${GROUP_ID}', 'Guacamole', 2000, true, 1);
  `);
}

test.beforeAll(() => {
  try {
    psql("select 1");
  } catch {
    throw new Error("Supabase local no disponible para E2E de catálogo.");
  }
  seedCatalog();
});

test.afterAll(() => {
  try {
    psql(`
      delete from public.order_items where order_id in (select id from public.orders where branch_id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}'));
      delete from public.orders where branch_id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
      delete from public.modifier_options where id = '${OPTION_ID}';
      delete from public.modifier_groups where id = '${GROUP_ID}';
      delete from public.branch_menu_items where menu_item_id like 'e11b1a-%';
      delete from public.menu_items where id like 'e11b1a-%';
      delete from public.categories where slug = 'e11b1a-carnes';
      delete from public.branches where id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
      delete from public.restaurants where id = '${RESTAURANT_ID}';
    `);
  } catch {
    // cleanup best-effort
  }
});

test.describe("Catálogo Supabase local", () => {
  test("muestra productos remotos y no el menú demo local", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/menu");
    await expect(page.getByText("Plato activo E2E")).toBeVisible();
    await expect(page.getByText("Carne asada plato con cebolleta")).toHaveCount(0);
    await expect(page.getByText("Plato inactivo E2E")).toHaveCount(0);
  });

  test("detalle remoto, modificador requerido y precio de sucursal", async ({ page }) => {
    await skipOnboarding(page);
    await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
    await page.goto(`/plato/${ITEM_ACTIVE}`);
    await expect(page.getByRole("heading", { name: "Plato activo E2E" })).toBeVisible();
    await expect(page.getByTestId("detail-total")).toHaveText(/22\.000/);
    await expect(page.getByRole("button", { name: "Añadir al carrito" })).toBeDisabled();
    await page.getByRole("radio", { name: /Guacamole/ }).click();
    await expect(page.getByTestId("detail-total")).toHaveText(/24\.000/);
    await expect(page.getByRole("button", { name: "Añadir al carrito" })).toBeEnabled();
  });

  test("producto inactivo no aparece como comprable en el menú", async ({ page }) => {
    await skipOnboarding(page);
    await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
    await page.goto("/menu");
    await expect(page.getByText("Plato inactivo E2E")).toHaveCount(0);
    await page.goto(`/plato/${ITEM_INACTIVE}`);
    await expect(page.getByRole("button", { name: "No disponible" })).toBeVisible();
  });

  test("checkout crea pedido real vía RPC (ya no persistence-pending)", async ({ request }) => {
    const key = crypto.randomUUID();
    const response = await request.post("/api/orders", {
      data: {
        idempotencyKey: key,
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        items: [
          {
            slug: ITEM_ACTIVE,
            quantity: 1,
            notes: "",
            modifiers: [{ groupId: GROUP_ID, optionId: OPTION_ID }],
          },
        ],
        tipPercent: 0,
        notes: "",
      },
    });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      code?: string;
      order?: {
        id: string;
        orderNumber: string;
        status: string;
        paymentStatus: string;
        totals: { total: number };
        replay?: boolean;
      };
    };
    expect(body.code).toBeUndefined();
    expect(body.order?.orderNumber).toMatch(/^CB-[0-9]{7}$/);
    expect(body.order?.status).toBe("pending");
    expect(body.order?.paymentStatus).toBe("pending");
    expect(body.order?.totals.total).toBe(25920);
    expect(body.order?.id).not.toBe(key);

    const replay = await request.post("/api/orders", {
      data: {
        idempotencyKey: key,
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        items: [
          {
            slug: ITEM_ACTIVE,
            quantity: 1,
            notes: "",
            modifiers: [{ groupId: GROUP_ID, optionId: OPTION_ID }],
          },
        ],
        tipPercent: 0,
        notes: "",
      },
    });
    expect(replay.status()).toBe(201);
    const replayBody = (await replay.json()) as { order?: { id: string; replay?: boolean } };
    expect(replayBody.order?.id).toBe(body.order?.id);
    expect(replayBody.order?.replay).toBe(true);

    const conflict = await request.post("/api/orders", {
      data: {
        idempotencyKey: key,
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        items: [
          {
            slug: ITEM_ACTIVE,
            quantity: 2,
            notes: "",
            modifiers: [{ groupId: GROUP_ID, optionId: OPTION_ID }],
          },
        ],
        tipPercent: 0,
        notes: "",
      },
    });
    expect(conflict.status()).toBe(409);
    const conflictBody = (await conflict.json()) as { code?: string };
    expect(conflictBody.code).toBe("idempotency-conflict");
  });

  test("guest checkout UI confirma order_number real y pago pendiente", async ({ page }) => {
    await skipOnboarding(page);
    await page.addInitScript(
      ({ itemId, groupId, optionId }) => {
        window.localStorage.setItem(
          "rb-cart",
          JSON.stringify({
            state: {
              items: [
                {
                  lineId: `${itemId}:${optionId}`,
                  itemId,
                  slug: itemId,
                  nameSnapshot: "Plato activo E2E",
                  unitPriceSnapshot: 22000,
                  quantity: 1,
                  notes: "",
                  modifiers: [
                    {
                      groupId,
                      groupName: "Extra",
                      optionId,
                      optionName: "Guacamole",
                      priceSnapshot: 2000,
                    },
                  ],
                  imagePath: "/icon.svg",
                },
              ],
              branchId: "branch-centro",
              fulfillmentType: "pickup",
              couponCode: null,
              tipPercent: 0,
            },
            version: 1,
          }),
        );
      },
      { itemId: ITEM_ACTIVE, groupId: GROUP_ID, optionId: OPTION_ID },
    );
    await page.clock.setFixedTime(new Date("2026-07-21T12:00:00-05:00"));
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre completo").fill("Ana Pérez");
    await page.getByLabel("Teléfono").fill("3001234567");
    await page.getByLabel("Correo electrónico").fill("ana-ui@example.com");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page.getByRole("heading", { name: "¡Pedido confirmado!" })).toBeVisible();
    await expect(page.locator("#contenido").getByText(/CB-[0-9]{7}/).first()).toBeVisible();
    await expect(page.getByText("Pago pendiente")).toBeVisible();
    await expect(page.getByText(/^Pagado/i)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "¡Pedido confirmado!" })).toBeVisible();
  });

  test("payload manipulado de precio no altera validación; opción inválida falla", async ({ request }) => {
    const badModifier = await request.post("/api/orders", {
      data: {
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        items: [
          {
            slug: ITEM_ACTIVE,
            quantity: 1,
            notes: "",
            modifiers: [{ groupId: GROUP_ID, optionId: "option-inventada" }],
            unitPrice: 1,
          },
        ],
        tipPercent: 0,
        notes: "",
      },
    });
    expect(badModifier.status()).toBe(409);
    const badBody = (await badModifier.json()) as { code?: string };
    expect(badBody.code).toBe("modifier-invalid");

    const unavailable = await request.post("/api/orders", {
      data: {
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        branchId: "branch-centro",
        fulfillmentType: "pickup",
        customer: { name: "Ana Pérez", phone: "3001234567", email: "ana@example.com" },
        items: [{ slug: ITEM_UNAVAILABLE, quantity: 1, notes: "", modifiers: [] }],
        tipPercent: 0,
        notes: "",
      },
    });
    expect(unavailable.status()).toBe(409);
    const unavailableBody = (await unavailable.json()) as { code?: string };
    expect(["item-unavailable", "item-missing"]).toContain(unavailableBody.code);
  });
});
