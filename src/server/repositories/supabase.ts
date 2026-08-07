import "server-only";

import { getSupabaseAnonClient } from "@/lib/supabase/client";
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
import { createIncludedLunchSoupGroup, getIncludedLunchSoups, isSoupItem } from "@/lib/menu/included-soups";
import { requireConfiguredBranch } from "@/server/catalog/branch-config";
import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { MenuRepository } from "./types";
import type { Order } from "@/types/order";
import type { OrderRepository } from "./types";

const menuSelect =
  "id, slug, name, short_name, category_slug, short_description, description, base_price, available, featured, tags, ingredients, allergens, preparation_minutes, display_order, image_path, image_width, image_height, image_blur_data_url, original_filename";

export class CatalogReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogReadError";
  }
}

async function resolveBranchUuid(branchId: string): Promise<string> {
  const configured = requireConfiguredBranch(branchId);
  const { data, error } = await getSupabaseAnonClient()
    .from("branches")
    .select("id, slug, status")
    .eq("slug", configured.slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new CatalogReadError("No se pudo resolver la sucursal del catálogo.");
  if (!data?.id) throw new CatalogReadError("La sucursal no existe en el catálogo remoto.");
  return data.id as string;
}

function attachIncludedSoups(items: MenuItem[]): MenuItem[] {
  const soups = getIncludedLunchSoups(items);
  if (soups.length === 0) return items;
  const group = createIncludedLunchSoupGroup(soups);
  return items.map((item) => (isSoupItem(item) ? item : {
    ...item,
    modifierGroups: [...item.modifierGroups.filter((candidate) => candidate.id !== group.id), group],
  }));
}

async function loadModifiers(menuItemIds: string[]): Promise<{
  groups: CatalogModifierGroupRow[];
  options: CatalogModifierOptionRow[];
}> {
  if (menuItemIds.length === 0) return { groups: [], options: [] };
  const client = getSupabaseAnonClient();
  const { data: groups, error: groupsError } = await client
    .from("modifier_groups")
    .select("id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order")
    .in("menu_item_id", menuItemIds);
  if (groupsError) throw new CatalogReadError("No se pudieron leer los modificadores.");
  const groupRows = (groups ?? []) as CatalogModifierGroupRow[];
  const groupIds = groupRows.map((group) => group.id);
  if (groupIds.length === 0) return { groups: groupRows, options: [] };
  const { data: options, error: optionsError } = await client
    .from("modifier_options")
    .select("id, modifier_group_id, name, additional_price, available, display_order")
    .in("modifier_group_id", groupIds);
  if (optionsError) throw new CatalogReadError("No se pudieron leer las opciones de modificador.");
  return { groups: groupRows, options: (options ?? []) as CatalogModifierOptionRow[] };
}

export class SupabaseMenuRepository implements MenuRepository {
  async getCategories(): Promise<CategoryInfo[]> {
    const { data, error } = await getSupabaseAnonClient()
      .from("categories")
      .select("slug, name, description, display_order, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) throw new CatalogReadError("No se pudieron leer las categorías.");
    return mapCatalogCategories((data ?? []) as CatalogCategoryRow[]);
  }

  async getMenuItems(options: { branchId: string }): Promise<MenuItem[]> {
    const branchUuid = await resolveBranchUuid(options.branchId);
    const client = getSupabaseAnonClient();
    const categories = await this.getCategories();

    const [{ data: items, error: itemsError }, { data: branchRows, error: branchError }] = await Promise.all([
      client.from("menu_items").select(menuSelect).eq("available", true).order("display_order", { ascending: true }),
      client.from("branch_menu_items").select("menu_item_id, price, available").eq("branch_id", branchUuid),
    ]);
    if (itemsError) throw new CatalogReadError("No se pudo leer el menú.");
    if (branchError) throw new CatalogReadError("No se pudo leer la disponibilidad por sucursal.");

    const itemRows = (items ?? []) as CatalogMenuItemRow[];
    const branchByItem = new Map(
      ((branchRows ?? []) as CatalogBranchMenuRow[]).map((row) => [row.menu_item_id, row]),
    );
    const { groups, options: modifierOptions } = await loadModifiers(itemRows.map((row) => row.id));

    const mapped = itemRows
      .map((row) => mapCatalogMenuItem(row, branchByItem.get(row.id), groups, modifierOptions))
      .filter((item): item is MenuItem => item !== null);

    return attachIncludedSoups(sortCatalogMenuItems(mapped, categories));
  }

  async getMenuItemBySlug(slug: string, options: { branchId: string }): Promise<MenuItem | null> {
    const branchUuid = await resolveBranchUuid(options.branchId);
    const client = getSupabaseAnonClient();
    const { data: item, error } = await client
      .from("menu_items")
      .select(menuSelect)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new CatalogReadError("No se pudo leer el plato.");
    if (!item) return null;

    const row = item as CatalogMenuItemRow;
    const { data: branchRow, error: branchError } = await client
      .from("branch_menu_items")
      .select("menu_item_id, price, available")
      .eq("branch_id", branchUuid)
      .eq("menu_item_id", row.id)
      .maybeSingle();
    if (branchError) throw new CatalogReadError("No se pudo leer la disponibilidad del plato.");

    const { groups, options: modifierOptions } = await loadModifiers([row.id]);
    const mapped = mapCatalogMenuItem(
      row,
      (branchRow as CatalogBranchMenuRow | null) ?? undefined,
      groups,
      modifierOptions,
    );
    if (!mapped) return null;

    // Sopa incluida: necesita el resto del catálogo de la sucursal.
    if (!isSoupItem(mapped)) {
      const all = await this.getMenuItems(options);
      return all.find((candidate) => candidate.slug === slug) ?? mapped;
    }
    return mapped;
  }
}

/**
 * Persistencia remota de pedidos: deliberadamente deshabilitada (11B-2).
 * La validación autoritativa del catálogo ocurre antes de llegar aquí.
 */
export class SupabaseApplicationWriteDisabledError extends Error {
  constructor(resource: "pedido") {
    super(`La persistencia remota de ${resource} aún no está habilitada.`);
    this.name = "SupabaseApplicationWriteDisabledError";
  }
}

export class SupabaseOrderRepository implements OrderRepository {
  async saveOrder(_order: Order): Promise<Order> {
    throw new SupabaseApplicationWriteDisabledError("pedido");
  }

  async getOrderById(_id: string): Promise<Order | null> {
    return null;
  }
}
