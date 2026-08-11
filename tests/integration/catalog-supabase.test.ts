/**
 * Integración local: catálogo Supabase vía anon + fixtures controladas.
 * Requiere Supabase local; no usa producción.
 */
import { execFileSync } from "node:child_process";
import { getLocalSupabaseBrowserEnv } from "../helpers/local-supabase-env";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111101";
const BRANCH_ID = "11111111-1111-4111-8111-111111111102";
const OTHER_BRANCH_ID = "11111111-1111-4111-8111-111111111103";
const ITEM_ACTIVE = "e11b1a-plato-activo";
const ITEM_INACTIVE = "e11b1a-plato-inactivo";
const ITEM_NO_BRANCH = "e11b1a-plato-sin-sucursal";
const GROUP_ID = "e11b1a-group-extra";
const OPTION_ID = "e11b1a-option-guac";
const OPTION_INACTIVE = "e11b1a-option-off";

function psql(sql: string) {
  execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_Restaurante2.0", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    },
  );
}

describe("catálogo Supabase local", () => {
  beforeAll(() => {
    try {
      psql("select 1");
    } catch {
      throw new Error("Supabase local (54322) no disponible para integración de catálogo.");
    }

    const localSupabase = getLocalSupabaseBrowserEnv();
    process.env.DATA_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = localSupabase.url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = localSupabase.publishableKey;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = localSupabase.anonKey;

    psql(`
      delete from public.modifier_options where id in ('${OPTION_ID}', '${OPTION_INACTIVE}');
      delete from public.modifier_groups where id = '${GROUP_ID}';
      delete from public.branch_menu_items where menu_item_id like 'e11b1a-%';
      delete from public.menu_items where id like 'e11b1a-%';
      delete from public.categories where slug = 'e11b1a-carnes';
      delete from public.branches where id in ('${BRANCH_ID}', '${OTHER_BRANCH_ID}');
      delete from public.restaurants where id = '${RESTAURANT_ID}';
      delete from public.branch_menu_items where branch_id in (
        select id from public.branches where slug in ('centro', 'norte')
      );
      delete from public.opening_hours where branch_id in (
        select id from public.branches where slug in ('centro', 'norte')
      );
      delete from public.special_hours where branch_id in (
        select id from public.branches where slug in ('centro', 'norte')
      );
      delete from public.branches where slug in ('centro', 'norte');

      insert into public.restaurants (id, name, slug, status)
      values ('${RESTAURANT_ID}', 'Test Catalogo', 'e11b1a-rest', 'active');

      insert into public.branches (id, restaurant_id, name, slug, status, pickup_enabled, delivery_enabled)
      values
        ('${BRANCH_ID}', '${RESTAURANT_ID}', 'Centro test', 'centro', 'active', true, true),
        ('${OTHER_BRANCH_ID}', '${RESTAURANT_ID}', 'Norte test', 'norte', 'active', true, false);

      insert into public.categories (restaurant_id, name, slug, description, display_order, is_active)
      values ('${RESTAURANT_ID}', 'Carnes test', 'e11b1a-carnes', 'Cat', 1, true);

      insert into public.menu_items (
        id, restaurant_id, category_slug, slug, name, short_description, base_price,
        available, featured, display_order, image_path
      ) values
        ('${ITEM_ACTIVE}', '${RESTAURANT_ID}', 'e11b1a-carnes', '${ITEM_ACTIVE}', 'Plato activo', 'ok', 20000, true, true, 1, '/icon.svg'),
        ('${ITEM_INACTIVE}', '${RESTAURANT_ID}', 'e11b1a-carnes', '${ITEM_INACTIVE}', 'Plato inactivo', 'off', 15000, false, false, 2, '/icon.svg'),
        ('${ITEM_NO_BRANCH}', '${RESTAURANT_ID}', 'e11b1a-carnes', '${ITEM_NO_BRANCH}', 'Sin sucursal', 'x', 18000, true, false, 3, '/icon.svg');

      insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
        ('${BRANCH_ID}', '${ITEM_ACTIVE}', 22000, true),
        ('${BRANCH_ID}', '${ITEM_INACTIVE}', 15000, true),
        ('${OTHER_BRANCH_ID}', '${ITEM_ACTIVE}', 21000, false);

      insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
      values ('${GROUP_ID}', '${ITEM_ACTIVE}', 'Extra', 1, 1, true, 1);

      insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order) values
        ('${OPTION_ID}', '${GROUP_ID}', 'Guacamole', 2000, true, 1),
        ('${OPTION_INACTIVE}', '${GROUP_ID}', 'Apagado', 500, false, 2);
    `);
  });

  afterAll(() => {
    try {
      psql(`
        delete from public.modifier_options where id in ('${OPTION_ID}', '${OPTION_INACTIVE}');
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

  it("lee catálogo público con precio/modificadores y excluye inactivos y sin sucursal", async () => {
    vi.resetModules();
    const { SupabaseMenuRepository } = await import("@/server/repositories/supabase");
    const repo = new SupabaseMenuRepository();
    const items = await repo.getMenuItems({ branchId: "branch-centro" });
    const active = items.find((candidate) => candidate.id === ITEM_ACTIVE);
    expect(active).toBeTruthy();
    expect(active?.price).toBe(22000);
    expect(active?.available).toBe(true);
    expect(active?.modifierGroups[0]?.options.some((option) => option.id === OPTION_ID)).toBe(true);
    expect(items.some((candidate) => candidate.id === ITEM_INACTIVE)).toBe(false);
    expect(items.some((candidate) => candidate.id === ITEM_NO_BRANCH)).toBe(false);

    const categories = await repo.getCategories();
    expect(categories.some((category) => category.slug === "e11b1a-carnes")).toBe(true);

    const bySlug = await repo.getMenuItemBySlug(ITEM_ACTIVE, { branchId: "branch-centro" });
    expect(bySlug?.price).toBe(22000);

    const other = await repo.getMenuItems({ branchId: "branch-norte" });
    const onNorte = other.find((candidate) => candidate.id === ITEM_ACTIVE);
    expect(onNorte?.available).toBe(false);
    expect(onNorte?.price).toBe(21000);
  });
});
