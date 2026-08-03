import type { MenuItem, ModifierGroup } from "@/types/menu";

export const INCLUDED_LUNCH_SOUP_GROUP_ID = "included-lunch-soup";
export const NO_SOUP_OPTION_ID = "no-soup";

export function isSoupItem(item: Pick<MenuItem, "categorySlug">): boolean {
  return item.categorySlug === "sopas";
}

/** Las opciones nacen de productos reales; no duplica nombres ni disponibilidad. */
export function getIncludedLunchSoups(items: ReadonlyArray<MenuItem>): MenuItem[] {
  return items.filter(isSoupItem);
}

export function createIncludedLunchSoupGroup(
  soups: ReadonlyArray<MenuItem>,
): ModifierGroup {
  return {
    id: INCLUDED_LUNCH_SOUP_GROUP_ID,
    kind: "includedLunchSoup",
    name: "Sopa incluida",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    options: [
      ...soups.map((soup) => ({
        id: soup.id,
        name: soup.fullName,
        additionalPrice: 0,
        available: soup.available,
      })),
      {
        id: NO_SOUP_OPTION_ID,
        name: "Sin sopa",
        additionalPrice: 0,
        available: true,
      },
    ],
  };
}

export function getIncludedLunchSoupGroup(
  item: Pick<MenuItem, "modifierGroups">,
): ModifierGroup | undefined {
  return item.modifierGroups.find((group) => group.id === INCLUDED_LUNCH_SOUP_GROUP_ID);
}
