import type { Metadata } from "next";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { EmptyState } from "@/components/ui/states";
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

export default async function SearchPage() {
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  try {
    const catalog = await loadPublicCatalog();
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
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
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof CatalogReadError
      ? error.message
      : "No pudimos cargar la búsqueda.";
    return (
      <div className="px-4 pt-5">
        <EmptyState title="No se pudo cargar el menú" description={message} />
      </div>
    );
  }
}
