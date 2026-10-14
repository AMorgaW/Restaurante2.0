"use client";

import { useMemo } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { MenuGrid } from "@/components/menu/menu-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useMenuScrollRestoration } from "@/hooks/use-menu-scroll-restoration";
import { useMounted } from "@/hooks/use-mounted";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { useFavoritesStore } from "@/stores/favorites";
import { purchasableCatalogItems } from "@/lib/menu/flexible-orders";
import { getIncludedLunchSoups } from "@/lib/menu/included-soups";
import { useServicePeriod } from "@/hooks/use-service-period";
import { DEFAULT_SERVICE_SNAPSHOT, type ServiceSnapshot } from "@/lib/menu/service-period";
import type { CatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";
import type { MenuItem } from "@/types/menu";

/** Pantalla de favoritos persistidos por navegador. */
export function FavoritesScreen({
  items,
  allowDemoOverrides = true,
  initialServiceSnapshot = DEFAULT_SERVICE_SNAPSHOT,
  mobilePresentation = "compact",
}: {
  items: MenuItem[];
  allowDemoOverrides?: boolean;
  initialServiceSnapshot?: ServiceSnapshot;
  mobilePresentation?: CatalogMobilePresentation;
}) {
  const router = useTransitionRouter();
  const mounted = useMounted();
  const adjusted = useMenuItemsWithAdminOverrides(items, allowDemoOverrides);
  const favoriteSlugs = useFavoritesStore((state) => state.slugs);
  const service = useServicePeriod(initialServiceSnapshot);
  const catalogItems = useMemo(() => purchasableCatalogItems(adjusted), [adjusted]);
  const includedSoups = useMemo(() => getIncludedLunchSoups(adjusted), [adjusted]);

  const favorites = useMemo(
    () => catalogItems.filter((item) => favoriteSlugs.includes(item.slug)),
    [catalogItems, favoriteSlugs],
  );
  useMenuScrollRestoration("favorites", mounted);
  const hasStoredButHiddenFavorites = mounted && favorites.length === 0 && favoriteSlugs.length > 0;

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
      <h1 className="text-screen-title font-extrabold tracking-tight">Favoritos</h1>
      {!mounted ? (
        <div
          aria-busy="true"
          className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        >
          <FoodCardSkeleton />
          <FoodCardSkeleton />
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          title={hasStoredButHiddenFavorites ? "Tus favoritos no están disponibles" : "Aún no tienes favoritos"}
          description={
            hasStoredButHiddenFavorites
              ? "Los platos guardados ya no están disponibles para compra en este menú."
              : "Toca el corazón de cualquier plato para guardarlo aquí."
          }
          action={
            <Button size="md" onClick={() => router.push("/menu")}>
              Explorar el menú
            </Button>
          }
        />
      ) : (
        <MenuGrid
          items={favorites}
          servicePeriod={service.period}
          hasAvailableSoup={includedSoups.some((soup) => soup.available)}
          mobilePresentation={mobilePresentation}
        />
      )}
    </div>
  );
}
