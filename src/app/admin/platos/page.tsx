import { DishesScreen } from "@/components/admin/dishes-screen";
import { EmptyState } from "@/components/ui/states";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { getDefaultConfiguredBranch } from "@/server/catalog/branch-config";
import { loadPublicCatalog } from "@/server/catalog/load-public-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";

export const metadata = { title: "Platos" };
export const dynamic = "force-dynamic";

export default async function AdminDishesPage() {
  const auth = await authorizeAdminSection("catalog");
  const branchId = getDefaultConfiguredBranch().id;
  const dataMode = getResolvedDataMode();
  const mode = auth.mode === "local" || dataMode === "local" ? "local" : "supabase";

  try {
    if (mode === "local") {
      return (
        <DishesScreen
          mode="local"
          branchId={branchId}
          items={menuItems}
          categories={getCategoriesInUse()}
        />
      );
    }

    const catalog = await loadPublicCatalog(branchId);
    if (catalog.items.length === 0) {
      return (
        <EmptyState
          title="Catálogo vacío"
          description="No hay platos publicados para administrar en esta sucursal."
        />
      );
    }
    return (
      <DishesScreen
        mode="supabase"
        branchId={catalog.branchId}
        items={catalog.items}
        categories={catalog.categories}
      />
    );
  } catch (error) {
    const message =
      error instanceof CatalogReadError
        ? error.message
        : "No pudimos cargar el catálogo administrativo.";
    return <EmptyState title="Error al cargar platos" description={message} />;
  }
}
