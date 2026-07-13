import { getCategoryBySlug } from "@/lib/menu/categories";
import { fuzzyIncludes } from "@/lib/search/normalize";
import type { MenuItem } from "@/types/menu";

export type MenuSort = "recomendados" | "precio-asc" | "precio-desc" | "nombre";

export interface MenuFilterOptions {
  query?: string;
  categorySlug?: string | null;
  sort?: MenuSort;
  onlyAvailable?: boolean;
}

/**
 * Filtrado y ordenamiento del menú: puro y probado unitariamente.
 * La búsqueda ignora tildes y mayúsculas y cubre nombre, descripción
 * y nombre de la categoría.
 */
export function filterMenuItems(items: MenuItem[], options: MenuFilterOptions = {}): MenuItem[] {
  const { query = "", categorySlug = null, sort = "recomendados", onlyAvailable = false } = options;

  let result = items;

  if (categorySlug) {
    result = result.filter((item) => item.categorySlug === categorySlug);
  }

  if (onlyAvailable) {
    result = result.filter((item) => item.available);
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length > 0) {
    result = result.filter((item) => {
      const categoryName = getCategoryBySlug(item.categorySlug).name;
      return (
        fuzzyIncludes(item.fullName, trimmedQuery) ||
        fuzzyIncludes(item.shortDescription, trimmedQuery) ||
        fuzzyIncludes(categoryName, trimmedQuery)
      );
    });
  }

  switch (sort) {
    case "precio-asc":
      return [...result].sort((a, b) => a.price - b.price);
    case "precio-desc":
      return [...result].sort((a, b) => b.price - a.price);
    case "nombre":
      return [...result].sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
    default:
      return result;
  }
}
