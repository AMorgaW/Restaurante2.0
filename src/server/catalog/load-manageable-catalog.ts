import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDefaultConfiguredBranch, requireConfiguredBranch } from "@/server/catalog/branch-config";
import {
  mapCatalogCategories,
  mapCatalogMenuItem,
  sortCatalogMenuItems,
  type CatalogBranchMenuRow,
  type CatalogCategoryRow,
  type CatalogMenuItemRow,
  type CatalogModifierGroupRow,
  type CatalogModifierOptionRow,
} from "@/server/repositories/menu-mapper";
import { CatalogReadError } from "@/server/repositories/supabase";
import type { CategoryInfo, MenuItem } from "@/types/menu";

const menuSelect =
  "id, slug, name, short_name, category_slug, short_description, description, base_price, is_independently_orderable, available, featured, tags, ingredients, allergens, preparation_minutes, display_order, image_path, image_width, image_height, image_blur_data_url, original_filename";

/**
 * Catálogo para administración (owner/admin `/admin` o manager/editor `/empleado/catalogo`).
 * Incluye platos con `menu_items.available = false` para poder reactivarlos.
 * No sustituye al catálogo público (`loadPublicCatalog`), que filtra globales inactivos.
 */
export async function loadManageableCatalog(branchId?: string): Promise<{
  branchId: string;
  items: MenuItem[];
  categories: CategoryInfo[];
}> {
  const configured = branchId
    ? requireConfiguredBranch(branchId)
    : getDefaultConfiguredBranch();
  const client = await createServerSupabaseClient();

  const { data: branch, error: branchLookupError } = await client
    .from("branches")
    .select("id")
    .eq("slug", configured.slug)
    .eq("status", "active")
    .maybeSingle();
  if (branchLookupError) {
    throw new CatalogReadError("No se pudo resolver la sucursal de administración.");
  }
  const branchUuid =
    branch && typeof branch === "object" && "id" in branch && typeof (branch as { id: unknown }).id === "string"
      ? (branch as { id: string }).id
      : null;
  if (!branchUuid) {
    throw new CatalogReadError("No se pudo resolver la sucursal de administración.");
  }

  const [
    { data: categoriesRaw, error: categoriesError },
    { data: itemsRaw, error: itemsError },
    { data: branchRowsRaw, error: branchError },
  ] = await Promise.all([
    client
      .from("categories")
      .select("slug, name, description, display_order, is_active")
      .order("display_order", { ascending: true }),
    client.from("menu_items").select(menuSelect).order("display_order", { ascending: true }),
    client
      .from("branch_menu_items")
      .select("menu_item_id, price, available")
      .eq("branch_id", branchUuid),
  ]);

  if (categoriesError) throw new CatalogReadError("No se pudieron leer las categorías.");
  if (itemsError) throw new CatalogReadError("No se pudo leer el menú administrativo.");
  if (branchError) throw new CatalogReadError("No se pudo leer la disponibilidad por sucursal.");

  const itemRows = (itemsRaw ?? []) as CatalogMenuItemRow[];
  const branchByItem = new Map(
    ((branchRowsRaw ?? []) as CatalogBranchMenuRow[]).map((row) => [row.menu_item_id, row]),
  );

  const itemIds = itemRows.map((row) => row.id);
  let groups: CatalogModifierGroupRow[] = [];
  let options: CatalogModifierOptionRow[] = [];
  if (itemIds.length > 0) {
    const { data: groupRows, error: groupsError } = await client
      .from("modifier_groups")
      .select("id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order")
      .in("menu_item_id", itemIds);
    if (groupsError) throw new CatalogReadError("No se pudieron leer los modificadores.");
    groups = (groupRows ?? []) as CatalogModifierGroupRow[];
    const groupIds = groups.map((group) => group.id);
    if (groupIds.length > 0) {
      const { data: optionRows, error: optionsError } = await client
        .from("modifier_options")
        .select("id, modifier_group_id, name, additional_price, available, display_order")
        .in("modifier_group_id", groupIds);
      if (optionsError) throw new CatalogReadError("No se pudieron leer las opciones de modificador.");
      options = (optionRows ?? []) as CatalogModifierOptionRow[];
    }
  }

  const categories = mapCatalogCategories((categoriesRaw ?? []) as CatalogCategoryRow[]);
  const mapped = itemRows
    .map((row) => mapCatalogMenuItem(row, branchByItem.get(row.id), groups, options))
    .filter((item): item is MenuItem => item !== null);

  return {
    branchId: configured.id,
    items: sortCatalogMenuItems(mapped, categories),
    categories,
  };
}
