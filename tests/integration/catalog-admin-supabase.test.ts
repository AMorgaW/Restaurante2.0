/**
 * Integración local: escrituras admin de catálogo vía cliente autenticado + RLS.
 * Usuarios solo en Supabase local. service_role únicamente para crear/borrar
 * usuarios de prueba (nunca en la aplicación).
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const API = "http://127.0.0.1:54321";
const ANON =
  "[REDACTED_LOCAL_KEY]";
const SERVICE =
  "[REDACTED_LOCAL_SERVICE_ROLE]";

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222201";
const OWNER_ID = "22222222-2222-4222-8222-222222222211";
const EDITOR_ID = "22222222-2222-4222-8222-222222222212";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222213";
const KITCHEN_ID = "22222222-2222-4222-8222-222222222214";
const ITEM_ID = "e11b1b-plato-admin";
const GROUP_ID = "e11b1b-group";
const OPTION_ID = "e11b1b-option";
const PASSWORD = "[REDACTED_LOCAL_PASSWORD]";

let branchId = "";

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
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}

function psqlScalar(sql: string): string {
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
      "-tAc",
      sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

function adminAuth() {
  return createClient(API, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string) {
  const client = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `e11b1b-${email}` },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error("sin sesión");
  return createClient(API, ANON, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `e11b1b-authed-${email}` },
  });
}

describe("admin catálogo Supabase local (RLS)", () => {
  beforeAll(async () => {
    psql("select 1");
    psql(`
      delete from public.modifier_options where id = '${OPTION_ID}';
      delete from public.modifier_groups where id = '${GROUP_ID}';
      delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
      delete from public.menu_items where id = '${ITEM_ID}';
      delete from public.categories where slug = 'e11b1b-cat';
      delete from public.staff_branch_permissions where profile_id in ('${OWNER_ID}', '${EDITOR_ID}', '${KITCHEN_ID}');
      delete from public.profiles where id in ('${OWNER_ID}', '${EDITOR_ID}', '${CUSTOMER_ID}', '${KITCHEN_ID}');
      delete from auth.users where id in ('${OWNER_ID}', '${EDITOR_ID}', '${CUSTOMER_ID}', '${KITCHEN_ID}');

      insert into public.restaurants (id, name, slug, status)
      values ('${RESTAURANT_ID}', 'Admin Catalog Rest', 'e11b1b-rest', 'active')
      on conflict (id) do update set status = 'active';

      insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled)
      select '22222222-2222-4222-8222-222222222202', '${RESTAURANT_ID}', 'Centro', 'centro', 'active', true, true
      where not exists (select 1 from public.branches where slug = 'centro');

      update public.branches set status = 'active' where slug = 'centro';
    `);

    branchId = psqlScalar(
      "select id::text from public.branches where slug = 'centro' and status = 'active' limit 1",
    );
    if (!branchId) throw new Error("No hay sucursal centro activa.");

    const auth = adminAuth();
    for (const user of [
      { id: OWNER_ID, email: "owner-e11b1b@test.local" },
      { id: EDITOR_ID, email: "editor-e11b1b@test.local" },
      { id: CUSTOMER_ID, email: "customer-e11b1b@test.local" },
      { id: KITCHEN_ID, email: "kitchen-e11b1b@test.local" },
    ]) {
      await auth.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: PASSWORD,
        email_confirm: true,
      });
    }

    psql(`
      update public.profiles set role = 'owner', staff_status = 'active' where id = '${OWNER_ID}';
      update public.profiles set role = 'editor', staff_status = 'active' where id = '${EDITOR_ID}';
      update public.profiles set role = 'customer', staff_status = null where id = '${CUSTOMER_ID}';
      update public.profiles set role = 'kitchen', staff_status = 'active' where id = '${KITCHEN_ID}';

      insert into public.staff_branch_permissions (profile_id, branch_id) values
        ('${EDITOR_ID}', '${branchId}'),
        ('${KITCHEN_ID}', '${branchId}')
      on conflict do nothing;

      insert into public.categories (restaurant_id, name, slug, description, display_order, is_active)
      values ('${RESTAURANT_ID}', 'Cat Admin', 'e11b1b-cat', 'x', 1, true)
      on conflict (slug) do update set is_active = true;

      insert into public.menu_items (
        id, restaurant_id, category_slug, slug, name, short_description, base_price,
        available, featured, display_order, image_path
      ) values (
        '${ITEM_ID}', '${RESTAURANT_ID}', 'e11b1b-cat', '${ITEM_ID}', 'Plato admin', 'desc', 20000,
        true, false, 1, '/icon.svg'
      ) on conflict (id) do update set available = true, featured = false, short_description = 'desc';

      insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
      values ('${branchId}', '${ITEM_ID}', 20000, true)
      on conflict (branch_id, menu_item_id) do update set price = 20000, available = true;

      insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
      values ('${GROUP_ID}', '${ITEM_ID}', 'Extra', 0, 1, false, 1)
      on conflict (id) do nothing;

      insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order)
      values ('${OPTION_ID}', '${GROUP_ID}', 'Guac', 1000, true, 1)
      on conflict (id) do nothing;
    `);
  }, 90_000);

  afterAll(async () => {
    try {
      const auth = adminAuth();
      for (const id of [OWNER_ID, EDITOR_ID, CUSTOMER_ID, KITCHEN_ID]) {
        await auth.auth.admin.deleteUser(id);
      }
      psql(`
        delete from public.modifier_options where id = '${OPTION_ID}';
        delete from public.modifier_groups where id = '${GROUP_ID}';
        delete from public.branch_menu_items where menu_item_id = '${ITEM_ID}';
        delete from public.menu_items where id = '${ITEM_ID}';
        delete from public.categories where slug = 'e11b1b-cat';
        delete from public.staff_branch_permissions where profile_id in ('${OWNER_ID}', '${EDITOR_ID}', '${KITCHEN_ID}');
      `);
    } catch {
      // best-effort
    }
  }, 60_000);

  it("owner y editor pueden actualizar; customer y kitchen no", async () => {
    const owner = await signIn("owner-e11b1b@test.local");
    const editor = await signIn("editor-e11b1b@test.local");
    const customer = await signIn("customer-e11b1b@test.local");
    const kitchen = await signIn("kitchen-e11b1b@test.local");

    const ownerUpdate = await owner
      .from("menu_items")
      .update({ featured: true, short_description: "por owner" })
      .eq("id", ITEM_ID)
      .select("featured, short_description")
      .maybeSingle();
    expect(ownerUpdate.error).toBeNull();
    expect(ownerUpdate.data?.featured).toBe(true);

    const editorBranch = await editor
      .from("branch_menu_items")
      .upsert({ branch_id: branchId, menu_item_id: ITEM_ID, price: 25500, available: true })
      .select("price")
      .maybeSingle();
    expect(editorBranch.error).toBeNull();
    expect(editorBranch.data?.price).toBe(25500);

    const editorOption = await editor
      .from("modifier_options")
      .update({ additional_price: 2500, available: true })
      .eq("id", OPTION_ID)
      .eq("modifier_group_id", GROUP_ID)
      .select("additional_price")
      .maybeSingle();
    expect(editorOption.error).toBeNull();
    expect(editorOption.data?.additional_price).toBe(2500);

    const customerUpdate = await customer
      .from("menu_items")
      .update({ featured: false })
      .eq("id", ITEM_ID)
      .select("id");
    expect((customerUpdate.data ?? []).length).toBe(0);

    const kitchenUpdate = await kitchen
      .from("branch_menu_items")
      .update({ price: 1 })
      .eq("menu_item_id", ITEM_ID)
      .select("price");
    expect((kitchenUpdate.data ?? []).length).toBe(0);

    const publicRead = createClient(API, ANON, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "e11b1b-public" },
    });
    const { data: publicItem } = await publicRead
      .from("branch_menu_items")
      .select("price, available")
      .eq("branch_id", branchId)
      .eq("menu_item_id", ITEM_ID)
      .maybeSingle();
    expect(publicItem?.price).toBe(25500);
  });
});
