import type { Metadata } from "next";
import { CompactCatalogPrepaint } from "@/components/menu/compact-catalog-prepaint";
import { FavoritesScreen } from "@/components/menu/favorites-screen";
import { EmptyState } from "@/components/ui/states";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";
import { getCatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";
import { createServiceSnapshot } from "@/lib/menu/service-period";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Tus platos guardados.",
  robots: { index: false },
};

export default async function FavoritesPage() {
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  const mobilePresentation = getCatalogMobilePresentation({ kind: "favorites" });
  try {
    const catalog = await loadPublicCatalog();
    return (
      <>
        {mobilePresentation === "compact" ? <CompactCatalogPrepaint /> : null}
        <FavoritesScreen
          items={catalog.items}
          allowDemoOverrides={catalog.allowDemoOverrides}
          initialServiceSnapshot={initialServiceSnapshot}
          mobilePresentation={mobilePresentation}
        />
      </>
    );
  } catch (error) {
    const message = error instanceof CatalogReadError
      ? error.message
      : "No pudimos cargar tus favoritos.";
    return <EmptyState title="Catálogo no disponible" description={message} />;
  }
}
