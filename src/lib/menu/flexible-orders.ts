import { isSoupItem } from "@/lib/menu/included-soups";
import type { MenuItem } from "@/types/menu";

/**
 * Pedidos flexibles. El catalogo digital aun no vende sopa sola,
 * porcion de arroz ni arroz con sopa. Pendiente de la etapa de
 * catalogo y pedidos: no inventar precios ni acciones de compra.
 */
export const flexibleOrderCatalog = {
  standaloneSoup: false,
  ricePortion: false,
  riceWithSoup: false,
} as const;

export const STANDALONE_PORTIONS_PENDING_COPY =
  "Sopa sola, porción de arroz o arroz con sopa son pedidos distintos. Este menú todavía no los ofrece para añadir al carrito.";

export function purchasableCatalogItems<T extends Pick<MenuItem, "categorySlug">>(
  items: ReadonlyArray<T>,
): T[] {
  if (flexibleOrderCatalog.standaloneSoup) return [...items];
  return items.filter((item) => !isSoupItem(item));
}