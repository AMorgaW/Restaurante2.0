import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/product/product-detail-screen";
import { JsonLd } from "@/components/seo/json-ld";
import { getMenuItemBySlug, menuItems } from "@/data/menu";
import { menuItemJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";
import { getIncludedLunchSoups } from "@/lib/menu/included-soups";
import { createServiceSnapshot } from "@/lib/menu/service-period";

interface DishPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: DishPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getMenuItemBySlug(slug);
  if (!item) return { title: "Plato no encontrado" };

  return {
    title: item.fullName,
    description: item.shortDescription,
    alternates: { canonical: `${siteUrl}/plato/${item.slug}` },
    openGraph: {
      title: item.fullName,
      description: item.shortDescription,
      images: [{ url: item.image.publicPath, width: item.image.width, height: item.image.height }],
    },
  };
}

export default async function DishPage({ params }: DishPageProps) {
  const { slug } = await params;
  const item = getMenuItemBySlug(slug);
  if (!item) {
    notFound();
  }

  return (
    <>
      <JsonLd data={menuItemJsonLd(item)} />
      <ProductDetailScreen
        item={item}
        includedSoups={getIncludedLunchSoups(menuItems)}
        initialServiceSnapshot={createServiceSnapshot(new Date())}
      />
    </>
  );
}
