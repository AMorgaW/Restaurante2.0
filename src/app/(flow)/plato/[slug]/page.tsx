import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/product/product-detail-screen";
import { JsonLd } from "@/components/seo/json-ld";
import { EmptyState } from "@/components/ui/states";
import { menuItemJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";
import { getIncludedLunchSoups } from "@/lib/menu/included-soups";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { loadPublicMenuItem } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

interface DishPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DishPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const result = await loadPublicMenuItem(slug);
    if (!result.item) return { title: "Plato no encontrado" };
    return {
      title: result.item.fullName,
      description: result.item.shortDescription,
      alternates: { canonical: `${siteUrl}/plato/${result.item.slug}` },
      openGraph: {
        title: result.item.fullName,
        description: result.item.shortDescription,
        images: [{
          url: result.item.image.publicPath,
          width: result.item.image.width,
          height: result.item.image.height,
        }],
      },
    };
  } catch {
    return { title: "Plato" };
  }
}

export default async function DishPage({ params }: DishPageProps) {
  const { slug } = await params;
  try {
    const result = await loadPublicMenuItem(slug);
    if (!result.item) notFound();

    return (
      <>
        <JsonLd data={menuItemJsonLd(result.item)} />
        <ProductDetailScreen
          item={result.item}
          includedSoups={getIncludedLunchSoups(result.items)}
          initialServiceSnapshot={createServiceSnapshot(new Date())}
          allowDemoOverrides={result.allowDemoOverrides}
        />
      </>
    );
  } catch (error) {
    if (error instanceof CatalogReadError) {
      return <EmptyState title="No se pudo cargar el plato" description={error.message} />;
    }
    throw error;
  }
}
