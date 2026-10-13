import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CompactCatalogPrepaint } from "@/components/menu/compact-catalog-prepaint";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { EmptyState } from "@/components/ui/states";
import { siteUrl } from "@/lib/env/client";
import { getCatalogMobilePresentation } from "@/lib/menu/catalog-mobile-presentation";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  try {
    const catalog = await loadPublicCatalog();
    const category = catalog.categories.find((candidate) => candidate.slug === categorySlug);
    if (!category) return { title: "Categoría no encontrada" };
    return {
      title: `${category.name} — Menú`,
      description: `${category.description}. Platos de ${category.name.toLowerCase()} preparados en casa.`,
      alternates: { canonical: `${siteUrl}/menu/${category.slug}` },
    };
  } catch {
    return { title: "Menú" };
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const initialServiceSnapshot = createServiceSnapshot(new Date());
  try {
    const catalog = await loadPublicCatalog();
    const category = catalog.categories.find((candidate) => candidate.slug === categorySlug);
    const items = catalog.items.filter((item) => item.categorySlug === categorySlug);
    if (!category || items.length === 0) notFound();
    const mobilePresentation = getCatalogMobilePresentation({ kind: "category", category });

    return (
      <div className="flex flex-col gap-4 md:px-0">
        <PageHeader title={category.name} backHref="/menu" />
        <div className="px-4 md:px-0">
          <p className="-mt-2 mb-3 text-sm text-muted">{category.description}</p>
          {mobilePresentation === "compact" ? <CompactCatalogPrepaint /> : null}
          <MenuExplorer
            items={catalog.items}
            categories={catalog.categories}
            initialServiceSnapshot={initialServiceSnapshot}
            lockedCategory={categorySlug}
            showSort
            allowDemoOverrides={catalog.allowDemoOverrides}
            mobilePresentation={mobilePresentation}
          />
        </div>
      </div>
    );
  } catch (error) {
    const message = error instanceof CatalogReadError
      ? error.message
      : "No pudimos cargar la categoría.";
    return (
      <div className="px-4 pt-5">
        <EmptyState title="No se pudo cargar el menú" description={message} />
      </div>
    );
  }
}
