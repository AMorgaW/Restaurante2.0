"use client";

import { useMemo } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { useAdminStore } from "@/stores/admin";
import type { MenuItem } from "@/types/menu";

/**
 * Aplica los ajustes demo del panel de administración (precio,
 * disponibilidad, destacado, descripción) sobre los platos base.
 * Se aplican tras el montaje para no romper la hidratación.
 */
export function useMenuItemsWithAdminOverrides(baseItems: MenuItem[]): MenuItem[] {
  const mounted = useMounted();
  const overrides = useAdminStore((state) => state.overrides);

  return useMemo(() => {
    if (!mounted || Object.keys(overrides).length === 0) return baseItems;
    return baseItems.map((item) => {
      const override = overrides[item.slug];
      if (!override) return item;
      return {
        ...item,
        ...(override.price !== undefined ? { price: override.price } : {}),
        ...(override.available !== undefined ? { available: override.available } : {}),
        ...(override.featured !== undefined ? { featured: override.featured } : {}),
        ...(override.shortDescription !== undefined
          ? { shortDescription: override.shortDescription }
          : {}),
      };
    });
  }, [baseItems, overrides, mounted]);
}
