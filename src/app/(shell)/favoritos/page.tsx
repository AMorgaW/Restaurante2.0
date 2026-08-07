import type { Metadata } from "next";
import { FavoritesScreen } from "@/components/menu/favorites-screen";
import { EmptyState } from "@/components/ui/states";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Tus platos guardados.",
  robots: { index: false },
};

export default async function FavoritesPage() {
  try {
    const catalog = await loadPublicCatalog();
    return (
      <FavoritesScreen
        items={catalog.items}
        allowDemoOverrides={catalog.allowDemoOverrides}
      />
    );
  } catch (error) {
    const message = error instanceof CatalogReadError
      ? error.message
      : "No pudimos cargar tus favoritos.";
    return <EmptyState title="Catálogo no disponible" description={message} />;
  }
}
