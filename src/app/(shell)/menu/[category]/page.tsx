import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { getCategoriesInUse, getItemsByCategory, menuItems } from "@/data/menu";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { siteUrl } from "@/lib/env/client";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

/** Categorías conocidas en build: slugs desconocidos → 404 real. */
export const dynamicParams = false;

export function generateStaticParams() {
  return getCategoriesInUse().map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const exists = getCategoriesInUse().some((category) => category.slug === categorySlug);
  if (!exists) return { title: "Categoría no encontrada" };
  const category = getCategoryBySlug(categorySlug);
  return {
    title: `${category.name} — Menú`,
    description: `${category.description}. Platos de ${category.name.toLowerCase()} preparados en casa.`,
    alternates: { canonical: `${siteUrl}/menu/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const items = getItemsByCategory(categorySlug);
  const exists = getCategoriesInUse().some((category) => category.slug === categorySlug);
  if (!exists || items.length === 0) {
    notFound();
  }
  const category = getCategoryBySlug(categorySlug);

  return (
    <div className="flex flex-col gap-4 md:px-0">
      <PageHeader title={category.name} backHref="/menu" />
      <div className="px-4 md:px-0">
        <p className="-mt-2 mb-3 text-sm text-muted">{category.description}</p>
        <MenuExplorer
          items={menuItems}
          categories={getCategoriesInUse()}
          lockedCategory={categorySlug}
          showSort
        />
      </div>
    </div>
  );
}
