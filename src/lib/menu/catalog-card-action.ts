import { supportsIncludedLunchSoup } from "@/lib/menu/included-soups";
import type { ServicePeriod } from "@/lib/menu/service-period";
import type { MenuItem } from "@/types/menu";

/** Mismo texto que ya muestra la tarjeta del catálogo en el almuerzo. */
export const INCLUDED_SOUP_HINT = "Puede llevar sopa";

export type CatalogCardAction =
  | { kind: "choose-soup"; href: string; label: string }
  | { kind: "quick-add"; label: string }
  | { kind: "closed"; label: string }
  | { kind: "none" };

type CatalogCardSubject = Pick<MenuItem, "available" | "fullName" | "slug" | "modifierGroups">;

/**
 * Decide la acción de la tarjeta con las mismas ramas que el catálogo:
 * almuerzo disponible abre la sopa, la cena sin modificadores de servicio
 * añade directo, el cierre deja el botón inactivo, y el resto no ofrece
 * añadido desde la tarjeta.
 */
export function catalogCardAction(
  item: CatalogCardSubject,
  servicePeriod: ServicePeriod,
  hasAvailableSoup: boolean,
): CatalogCardAction {
  const nonServiceModifiers = item.modifierGroups.filter(
    (group) => group.kind !== "includedLunchSoup",
  );
  const canQuickAdd = item.available && nonServiceModifiers.length === 0;

  if (servicePeriod === "lunch" && item.available) {
    return {
      kind: "choose-soup",
      href: `/plato/${item.slug}#sopa-incluida`,
      label: hasAvailableSoup
        ? `Elegir sopa para ${item.fullName}`
        : `Elegir sin sopa para ${item.fullName}`,
    };
  }
  if (canQuickAdd && servicePeriod === "dinner") {
    return { kind: "quick-add", label: `Añadir ${item.fullName} al carrito` };
  }
  if (servicePeriod === "closed") {
    return {
      kind: "closed",
      label: `No se puede añadir ${item.fullName}: el restaurante está cerrado`,
    };
  }
  return { kind: "none" };
}

export function showsIncludedSoupHint(servicePeriod: ServicePeriod): boolean {
  return servicePeriod === "lunch";
}

/**
 * La compacta muestra el aviso solo cuando la acción existente es elegir
 * sopa y el plato realmente la admite. Un agotado no elige sopa, y una
 * sopa independiente no lleva el grupo incluido.
 */
export function compactCardPresentsSoup(
  item: CatalogCardSubject & Pick<MenuItem, "categorySlug">,
  servicePeriod: ServicePeriod,
  hasAvailableSoup: boolean,
): boolean {
  return (
    catalogCardAction(item, servicePeriod, hasAvailableSoup).kind === "choose-soup" &&
    supportsIncludedLunchSoup(item)
  );
}
