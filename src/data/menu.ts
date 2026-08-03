import { menuManifest } from "@/data/generated/menu-manifest";
import { menuOverrides } from "@/data/menu-overrides";
import { CATEGORIES, getCategoryBySlug } from "@/lib/menu/categories";
import { demoDescriptionFor, demoPriceFor } from "@/lib/demo/pricing";
import {
  createIncludedLunchSoupGroup,
  getIncludedLunchSoups,
  isSoupItem,
} from "@/lib/menu/included-soups";
import type { CategoryInfo, MenuItem } from "@/types/menu";

/**
 * Fusión del manifiesto generado con los overrides manuales y el
 * contenido demo determinista. Es la única fuente de verdad del menú
 * en modo local.
 */
function buildMenuItems(): MenuItem[] {
  const baseItems = menuManifest.map((manifestItem, index): MenuItem => {
    const override = menuOverrides[manifestItem.slug] ?? {};
    const categorySlug = override.categorySlug ?? manifestItem.categorySlug;
    const fullName = override.fullName ?? manifestItem.fullName;

    return {
      id: manifestItem.id,
      slug: manifestItem.slug,
      fullName,
      ...(override.shortName ? { shortName: override.shortName } : {}),
      categorySlug,
      shortDescription:
        override.shortDescription ??
        manifestItem.descriptionFromFilename ??
        demoDescriptionFor(manifestItem.slug, categorySlug),
      ...(override.description ?? manifestItem.descriptionFromFilename
        ? { description: override.description ?? manifestItem.descriptionFromFilename }
        : {}),
      price: override.price ?? demoPriceFor(manifestItem.slug, categorySlug),
      available: override.available ?? true,
      featured: override.featured ?? false,
      tags: override.tags ?? [],
      ...(override.ingredients ? { ingredients: override.ingredients } : {}),
      ...(override.allergens ? { allergens: override.allergens } : {}),
      ...(override.preparationMinutes !== undefined
        ? { preparationMinutes: override.preparationMinutes }
        : {}),
      displayOrder: override.displayOrder ?? (index + 1) * 10,
      image: manifestItem.image,
      modifierGroups: override.modifierGroups ?? [],
    };
  });

  const soups = getIncludedLunchSoups(baseItems);
  const includedSoupGroup = createIncludedLunchSoupGroup(soups);
  const items = baseItems.map((item) =>
    isSoupItem(item)
      ? item
      : { ...item, modifierGroups: [...item.modifierGroups, includedSoupGroup] },
  );

  return items.sort((a, b) => {
    const categoryA = getCategoryBySlug(a.categorySlug).displayOrder;
    const categoryB = getCategoryBySlug(b.categorySlug).displayOrder;
    if (categoryA !== categoryB) return categoryA - categoryB;
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.fullName.localeCompare(b.fullName, "es");
  });
}

export const menuItems: MenuItem[] = buildMenuItems();

/** Categorías realmente presentes en el menú, en su orden configurado. */
export function getCategoriesInUse(): CategoryInfo[] {
  const inUse = new Set(menuItems.map((item) => item.categorySlug));
  return CATEGORIES.filter((category) => inUse.has(category.slug));
}

export function getMenuItemBySlug(slug: string): MenuItem | undefined {
  return menuItems.find((item) => item.slug === slug);
}

export function getItemsByCategory(categorySlug: string): MenuItem[] {
  return menuItems.filter((item) => item.categorySlug === categorySlug);
}

/** Platos destacados; si no hay marcados, se destacan los dos primeros. */
export function getFeaturedItems(): MenuItem[] {
  const featured = menuItems.filter((item) => item.featured && item.available);
  if (featured.length > 0) return featured;
  return menuItems.slice(0, 2);
}

/** Relacionados: misma categoría primero, completando con el resto. */
export function getRelatedItems(item: MenuItem, limit = 4): MenuItem[] {
  const sameCategory = menuItems.filter(
    (candidate) => candidate.slug !== item.slug && candidate.categorySlug === item.categorySlug,
  );
  const others = menuItems.filter(
    (candidate) => candidate.slug !== item.slug && candidate.categorySlug !== item.categorySlug,
  );
  return [...sameCategory, ...others].slice(0, limit);
}
