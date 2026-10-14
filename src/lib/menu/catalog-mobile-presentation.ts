import type { CategoryInfo } from "@/types/menu";

export type CatalogMobilePresentation = "row" | "compact";

/**
 * Solo las superficies de catálogo que ya resolvieron su categoría pueden
 * pedir esta política. Así el cambio cubre cualquier categoría activa del
 * catálogo sin convertir una URL inexistente en una categoría válida.
 */
export type CatalogMobilePresentationTarget =
  { kind: "menu" } | { kind: "category"; category: CategoryInfo } | { kind: "search" };

export function getCatalogMobilePresentation(
  _target: CatalogMobilePresentationTarget,
): CatalogMobilePresentation {
  return "compact";
}
