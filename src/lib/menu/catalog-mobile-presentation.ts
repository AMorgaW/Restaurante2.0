export type CatalogMobilePresentation = "row" | "compact";

/**
 * Superficies que ya tienen aprobada la composición compacta en móvil.
 * El listado completo siempre la usa; las categorías se habilitan una a una
 * para que cada expansión sea reversible y no afecte buscar/favoritos.
 */
const COMPACT_CATEGORY_PILOTS = new Set(["carnes"]);

export function getCatalogMobilePresentation(categorySlug?: string): CatalogMobilePresentation {
  return categorySlug === undefined || COMPACT_CATEGORY_PILOTS.has(categorySlug)
    ? "compact"
    : "row";
}
