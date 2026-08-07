import { CategoriesAdminScreen } from "@/components/admin/categories-admin-screen";
import { EmptyState } from "@/components/ui/states";
import { getCategoriesInUse, getItemsByCategory } from "@/data/menu";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadManageableCatalog } from "@/server/catalog/load-manageable-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

export const metadata = { title: "Categorías" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const auth = await authorizeAdminSection("catalog");
  const dataMode = getResolvedDataMode();
  const mode = auth.mode === "local" || dataMode === "local" ? "local" : "supabase";

  try {
    if (mode === "local") {
      const categories = getCategoriesInUse();
      const itemCounts = Object.fromEntries(
        categories.map((category) => [category.slug, getItemsByCategory(category.slug).length]),
      );
      return (
        <CategoriesAdminScreen mode="local" categories={categories} itemCounts={itemCounts} />
      );
    }

    const catalog = await loadManageableCatalog();
    const client = await createServerSupabaseClient();
    const { data: allCategories, error } = await client
      .from("categories")
      .select("slug, name, description, display_order, is_active")
      .order("display_order", { ascending: true });
    if (error) throw new CatalogReadError("No se pudieron leer las categorías administrativas.");

    const categories = ((allCategories ?? []) as Array<{
      slug: string;
      name: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
    }>).map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description ?? "",
      displayOrder: row.display_order,
      isActive: row.is_active,
    }));
    const itemCounts = Object.fromEntries(
      categories.map((category) => [
        category.slug,
        catalog.items.filter((item) => item.categorySlug === category.slug).length,
      ]),
    );

    return (
      <CategoriesAdminScreen mode="supabase" categories={categories} itemCounts={itemCounts} />
    );
  } catch (error) {
    const message =
      error instanceof CatalogReadError
        ? error.message
        : "No pudimos cargar las categorías.";
    return <EmptyState title="Error al cargar categorías" description={message} />;
  }
}
