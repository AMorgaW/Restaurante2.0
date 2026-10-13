import type { Metadata } from "next";
import { CompactCatalogPrepaint } from "@/components/menu/compact-catalog-prepaint";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { JsonLd } from "@/components/seo/json-ld";
import { EmptyState } from "@/components/ui/states";
import { menuJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";
import { getCatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menú",
  description:
    "Explora el menú completo: carnes a la brasa, sopas tradicionales y especialidades de la casa.",
  alternates: { canonical: `${siteUrl}/menu` },
};

export default async function MenuPage() {
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  const mobilePresentation = getCatalogMobilePresentation({ kind: "menu" });
  try {
    const catalog = await loadPublicCatalog();
    if (catalog.items.length === 0) {
      return (
        <div className="flex flex-col gap-4 px-4 pb-8 pt-4 md:px-0 md:pt-7">
          <EmptyState
            title="Menú vacío"
            description="Todavía no hay platos publicados para esta sucursal."
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 px-4 pb-8 pt-4 md:px-0 md:pt-7">
        {mobilePresentation === "compact" ? <CompactCatalogPrepaint /> : null}
        <JsonLd data={menuJsonLd(catalog.items)} />
        <MenuExplorer
          mobilePresentation={mobilePresentation}
          items={catalog.items}
          categories={catalog.categories}
          initialServiceSnapshot={initialServiceSnapshot}
          showSort
          title="Menú"
          allowDemoOverrides={catalog.allowDemoOverrides}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof CatalogReadError
      ? error.message
      : "No pudimos cargar el menú. Intenta de nuevo en unos minutos.";
    return (
      <div className="flex flex-col gap-4 px-4 pb-8 pt-4 md:px-0 md:pt-7">
        <EmptyState title="No se pudo cargar el menú" description={message} />
      </div>
    );
  }
}
