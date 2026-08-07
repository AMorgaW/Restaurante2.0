"use client";

import { useMemo } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { MenuGrid } from "@/components/menu/menu-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useMounted } from "@/hooks/use-mounted";
import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { useFavoritesStore } from "@/stores/favorites";
import type { MenuItem } from "@/types/menu";

/** Pantalla de favoritos persistidos por navegador. */
export function FavoritesScreen({
  items,
  allowDemoOverrides = true,
}: {
  items: MenuItem[];
  allowDemoOverrides?: boolean;
}) {
  const router = useTransitionRouter();
  const mounted = useMounted();
  const adjusted = useMenuItemsWithAdminOverrides(items, allowDemoOverrides);
  const favoriteSlugs = useFavoritesStore((state) => state.slugs);

  const favorites = useMemo(
    () => adjusted.filter((item) => favoriteSlugs.includes(item.slug)),
    [adjusted, favoriteSlugs],
  );

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
          title="Aún no tienes favoritos"
          description="Toca el corazón de cualquier plato para guardarlo aquí."
          action={
            <Button size="md" onClick={() => router.push("/menu")}>
              Explorar el menú
            </Button>
          }
        />
      ) : (
        <MenuGrid items={favorites} />
      )}
    </div>
  );
}
