import { AdminRoleProvider } from "@/components/admin/admin-role-context";
import { CategoriesAdminScreen } from "@/components/admin/categories-admin-screen";
import { EmptyState } from "@/components/ui/states";
import { getCategoriesInUse, getItemsByCategory } from "@/data/menu";
import { authorizeEmployeeCatalog } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadManageableCatalog } from "@/server/catalog/load-manageable-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";
import Link from "next/link";

export const metadata = { title: "Categorías · Empleado" };
export const dynamic = "force-dynamic";

export default async function EmployeeCatalogCategoriesPage() {
  const auth = await authorizeEmployeeCatalog();
  const dataMode = getResolvedDataMode();
  const mode = auth.mode === "local" || dataMode === "local" ? "local" : "supabase";

  try {
    if (mode === "local") {
      const categories = getCategoriesInUse();
      const itemCounts = Object.fromEntries(
        categories.map((category) => [category.slug, getItemsByCategory(category.slug).length]),
      );
      return (
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
          <Link href="/empleado/catalogo" className="text-sm font-semibold text-lime underline-offset-4 hover:underline">
            ← Volver a platos
          </Link>
          <AdminRoleProvider mode="local" role={auth.role}>
            <CategoriesAdminScreen mode="local" categories={categories} itemCounts={itemCounts} />
          </AdminRoleProvider>
        </div>
      );
    }

    const catalog = await loadManageableCatalog();
    const client = await createServerSupabaseClient();
    const { data: allCategories, error } = await client
      .from("categories")
      .select("slug, name, description, display_order, is_active")
      .order("display_order", { ascending: true });
    if (error) throw new CatalogReadError("No se pudieron leer las categorías.");

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
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
        <Link href="/empleado/catalogo" className="text-sm font-semibold text-lime underline-offset-4 hover:underline">
          ← Volver a platos
        </Link>
        <AdminRoleProvider mode="supabase" role={auth.role}>
          <CategoriesAdminScreen mode="supabase" categories={categories} itemCounts={itemCounts} />
        </AdminRoleProvider>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof CatalogReadError ? error.message : "No pudimos cargar las categorías.";
    return <EmptyState title="Error al cargar categorías" description={message} />;
  }
}
