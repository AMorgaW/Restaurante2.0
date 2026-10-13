import { getIncludedLunchSoups, isSoupItem } from "@/lib/menu/included-soups";
import { PHOTO_REVEAL_PILOT_SLUG } from "@/lib/menu/photo-reveal-pilot";
import type { ServicePeriod } from "@/lib/menu/service-period";
import {
  GEOMETRIC_SLIDE_PILOT_SLUG,
  TIMED_SLIDE_PILOT_SLUG,
} from "@/lib/menu/slide-calibration-pilot";
import type { MenuItem } from "@/types/menu";

export interface CompactLabCard {
  key: string;
  item: MenuItem;
  servicePeriod: ServicePeriod;
  hasAvailableSoup: boolean;
  /** Copia de presentación. No cambia la disponibilidad real del menú. */
  simulated?: boolean;
}

export interface CompactCardLab {
  /** Tarjeta actual, un slug que no se repite en las compactas. */
  current: MenuItem;
  states: CompactLabCard[];
  fill: CompactLabCard[];
  hasAvailableSoup: boolean;
}

function requireItem(items: readonly MenuItem[], slug: string): MenuItem {
  const item = items.find((entry) => entry.slug === slug);
  if (!item) {
    throw new Error(`El piloto compacto necesita el plato ${slug}.`);
  }
  return item;
}

/**
 * Arma la comparación del laboratorio con platos reales y un slug por
 * tarjeta. La cebolleta solo entra en la compacta de cena. El agotado
 * es una copia de presentación: no escribe el menú.
 */
export function buildCompactCardLab(items: readonly MenuItem[]): CompactCardLab {
  const current = requireItem(items, PHOTO_REVEAL_PILOT_SLUG);
  const longItem = requireItem(items, TIMED_SLIDE_PILOT_SLUG);
  const quickItem = requireItem(items, GEOMETRIC_SLIDE_PILOT_SLUG);
  const hasAvailableSoup = getIncludedLunchSoups(items).some((soup) => soup.available);

  const reserved = new Set([current.slug, longItem.slug, quickItem.slug]);
  const mains = items.filter((item) => !reserved.has(item.slug) && !isSoupItem(item));
  const closedSource = mains[0];
  const soldOutSource = mains[1];
  if (!closedSource || !soldOutSource) {
    throw new Error("El piloto compacto necesita dos platos más para cerrado y agotado.");
  }
  reserved.add(closedSource.slug);
  reserved.add(soldOutSource.slug);

  const soldOut: MenuItem = { ...soldOutSource, available: false };
  const states: CompactLabCard[] = [
    { key: "almuerzo", item: longItem, servicePeriod: "lunch", hasAvailableSoup },
    { key: "cena", item: quickItem, servicePeriod: "dinner", hasAvailableSoup },
    { key: "cerrado", item: closedSource, servicePeriod: "closed", hasAvailableSoup },
    { key: "agotado", item: soldOut, servicePeriod: "lunch", hasAvailableSoup, simulated: true },
  ];
  const fill = items
    .filter((item) => !reserved.has(item.slug))
    .slice(0, 8)
    .map((item) => ({
      key: item.slug,
      item,
      servicePeriod: "lunch" as const,
      hasAvailableSoup,
    }));

  return { current, states, fill, hasAvailableSoup };
}

export function compactLabSlugs(lab: CompactCardLab): string[] {
  return [
    lab.current.slug,
    ...lab.states.map((card) => card.item.slug),
    ...lab.fill.map((card) => card.item.slug),
  ];
}
