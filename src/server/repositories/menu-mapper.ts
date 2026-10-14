import type { CategoryInfo, MenuImageMeta, MenuItem, ModifierGroup, ModifierOption } from "@/types/menu";

/** Filas crudas del catálogo público (sin tipar filas PostgREST al UI). */
export type CatalogCategoryRow = {
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type CatalogMenuItemRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  category_slug: string;
  short_description: string | null;
  description: string | null;
  base_price: number;
  is_independently_orderable?: boolean;
  available: boolean;
  featured: boolean;
  tags: string[] | null;
  ingredients: string[] | null;
  allergens: string[] | null;
  preparation_minutes: number | null;
  display_order: number;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  image_blur_data_url: string | null;
  original_filename: string | null;
};

export type CatalogBranchMenuRow = {
  menu_item_id: string;
  price: number | null;
  available: boolean;
};

export type CatalogModifierGroupRow = {
  id: string;
  menu_item_id: string;
  name: string;
  minimum_selections: number;
  maximum_selections: number;
  required: boolean;
  display_order: number;
};

export type CatalogModifierOptionRow = {
  id: string;
  modifier_group_id: string;
  name: string;
  additional_price: number;
  available: boolean;
  display_order: number;
};

export class CatalogMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogMappingError";
  }
}

const PLACEHOLDER_IMAGE: MenuImageMeta = {
  originalFilename: "placeholder",
  publicPath: "/icon.svg",
  width: 512,
  height: 512,
  aspectRatio: 1,
  hasAlpha: true,
  blurDataURL: "",
  bytes: 0,
};

function assertNonNegativeInt(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new CatalogMappingError(`Valor monetario inválido (${label}).`);
  }
  return value;
}

export function mapCatalogImage(row: CatalogMenuItemRow): MenuImageMeta {
  const path = row.image_path?.trim();
  if (!path) return PLACEHOLDER_IMAGE;
  const width = row.image_width && row.image_width > 0 ? row.image_width : 1200;
  const height = row.image_height && row.image_height > 0 ? row.image_height : 800;
  return {
    originalFilename: row.original_filename ?? path,
    publicPath: path.startsWith("/") ? path : `/${path}`,
    width,
    height,
    aspectRatio: Math.round((width / height) * 1000) / 1000,
    hasAlpha: false,
    blurDataURL: row.image_blur_data_url ?? "",
    bytes: 0,
  };
}

export function mapCatalogCategories(rows: CatalogCategoryRow[]): CategoryInfo[] {
  return rows
    .filter((row) => row.is_active)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "es"));
}

export function mapModifierOptions(rows: CatalogModifierOptionRow[]): ModifierOption[] {
  return [...rows]
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "es"))
    .map((row) => ({
      id: row.id,
      name: row.name,
      additionalPrice: assertNonNegativeInt(row.additional_price, "additional_price"),
      available: row.available,
    }));
}

export function mapModifierGroups(
  groups: CatalogModifierGroupRow[],
  options: CatalogModifierOptionRow[],
): ModifierGroup[] {
  const byGroup = new Map<string, CatalogModifierOptionRow[]>();
  for (const option of options) {
    const list = byGroup.get(option.modifier_group_id) ?? [];
    list.push(option);
    byGroup.set(option.modifier_group_id, list);
  }

  return [...groups]
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "es"))
    .map((group) => {
      if (group.minimum_selections < 0 || group.maximum_selections < group.minimum_selections) {
        throw new CatalogMappingError(`Límites de modificador inválidos (${group.id}).`);
      }
      return {
        id: group.id,
        name: group.name,
        required: group.required,
        minSelections: group.minimum_selections,
        maxSelections: group.maximum_selections,
        options: mapModifierOptions(byGroup.get(group.id) ?? []),
      };
    });
}

export type BranchAvailability = {
  /** Ausente = no configurado en la sucursal (no comprable). */
  branchRow: CatalogBranchMenuRow | undefined;
};

/**
 * Precio efectivo y disponibilidad por sucursal.
 * Sin fila en `branch_menu_items` → no disponible para compra en esa sucursal.
 */
export function resolveBranchCommerce(
  item: CatalogMenuItemRow,
  branchRow: CatalogBranchMenuRow | undefined,
): { price: number; available: boolean; listed: boolean } {
  if (!branchRow) {
    return { price: assertNonNegativeInt(item.base_price, "base_price"), available: false, listed: false };
  }
  const price = branchRow.price == null
    ? assertNonNegativeInt(item.base_price, "base_price")
    : assertNonNegativeInt(branchRow.price, "branch_price");
  const available = item.available && branchRow.available;
  return { price, available, listed: true };
}

export function mapCatalogMenuItem(
  row: CatalogMenuItemRow,
  branchRow: CatalogBranchMenuRow | undefined,
  groups: CatalogModifierGroupRow[],
  options: CatalogModifierOptionRow[],
): MenuItem | null {
  const commerce = resolveBranchCommerce(row, branchRow);
  if (!commerce.listed || !branchRow) return null;

  const itemGroups = groups.filter((group) => group.menu_item_id === row.id);
  const groupIds = new Set(itemGroups.map((group) => group.id));
  const itemOptions = options.filter((option) => groupIds.has(option.modifier_group_id));

  return {
    id: row.id,
    slug: row.slug,
    fullName: row.name,
    ...(row.short_name ? { shortName: row.short_name } : {}),
    categorySlug: row.category_slug,
    shortDescription: row.short_description ?? "",
    ...(row.description ? { description: row.description } : {}),
    price: commerce.price,
    isIndependentlyOrderable: row.is_independently_orderable ?? row.category_slug !== "sopas",
    available: commerce.available,
    globalAvailable: row.available,
    branchAvailable: branchRow.available,
    featured: row.featured,
    tags: row.tags ?? [],
    ...(row.ingredients ? { ingredients: row.ingredients } : {}),
    ...(row.allergens ? { allergens: row.allergens } : {}),
    ...(row.preparation_minutes != null ? { preparationMinutes: row.preparation_minutes } : {}),
    displayOrder: row.display_order,
    image: mapCatalogImage(row),
    modifierGroups: mapModifierGroups(itemGroups, itemOptions),
  };
}

export function sortCatalogMenuItems(items: MenuItem[], categories: CategoryInfo[]): MenuItem[] {
  const categoryOrder = new Map(categories.map((category) => [category.slug, category.displayOrder]));
  return [...items].sort((a, b) => {
    const orderA = categoryOrder.get(a.categorySlug) ?? Number.MAX_SAFE_INTEGER;
    const orderB = categoryOrder.get(b.categorySlug) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.fullName.localeCompare(b.fullName, "es");
  });
}
