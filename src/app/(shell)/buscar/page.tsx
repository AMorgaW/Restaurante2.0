import type { Metadata } from "next";
import { CompactCatalogPrepaint } from "@/components/menu/compact-catalog-prepaint";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { EmptyState } from "@/components/ui/states";
import { getCatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";
import { siteUrl } from "@/lib/env/client";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca platos por nombre, descripción o categoría.",
  alternates: { canonical: `${siteUrl}/buscar` },
};

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; query?: string | string[] }>;
}) {
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  const params = await searchParams;
  const initialQuery = firstSearchParam(params.q) ?? firstSearchParam(params.query);
  const mobilePresentation = getCatalogMobilePresentation({ kind: "search" });
  try {
    const catalog = await loadPublicCatalog();
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
        {mobilePresentation === "compact" ? <CompactCatalogPrepaint /> : null}
        <h1 className="text-screen-title font-extrabold tracking-tight">Buscar</h1>
        <p className="-mt-2 text-sm text-muted">
          Encuentra tu plato por nombre, ingrediente del título o categoría.
        </p>
        <MenuExplorer
          items={catalog.items}
          categories={catalog.categories}
          initialServiceSnapshot={initialServiceSnapshot}
          showSort
          allowDemoOverrides={catalog.allowDemoOverrides}
          mobilePresentation={mobilePresentation}
          viewScope="search"
          initialQuery={initialQuery}
        />
      </div>
    );
  } catch (error) {
    const message =
      error instanceof CatalogReadError ? error.message : "No pudimos cargar la búsqueda.";
    return (
      <div className="px-4 pt-5">
        <EmptyState title="No se pudo cargar el menú" description={message} />
      </div>
    );
  }
}
