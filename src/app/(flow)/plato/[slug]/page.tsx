import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailScreen } from "@/components/product/product-detail-screen";
import { JsonLd } from "@/components/seo/json-ld";
import { getMenuItemBySlug, getRelatedItems, menuItems } from "@/data/menu";
import { menuItemJsonLd } from "@/lib/seo/structured-data";
import { siteUrl } from "@/lib/env/client";

interface DishPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * El menú se conoce en build (manifiesto): los slugs desconocidos deben
 * responder 404 real, sin streaming que comprometa el status code.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return menuItems.map((item) => ({ slug: item.slug }));
}

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
      <ProductDetailScreen item={item} related={getRelatedItems(item)} />
    </>
  );
}
