import { AdminRoleProvider } from "@/components/admin/admin-role-context";
import { DishesScreen } from "@/components/admin/dishes-screen";
import { EmptyState } from "@/components/ui/states";
import { getCategoriesInUse, menuItems } from "@/data/menu";
import { authorizeEmployeeCatalog } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { getDefaultConfiguredBranch } from "@/server/catalog/branch-config";
import { loadManageableCatalog } from "@/server/catalog/load-manageable-catalog";
import { CatalogReadError } from "@/server/repositories/supabase";
import Link from "next/link";

export const metadata = { title: "Catálogo · Empleado" };
export const dynamic = "force-dynamic";

export default async function EmployeeCatalogPage() {
  const auth = await authorizeEmployeeCatalog();
  const branchId = getDefaultConfiguredBranch().id;
  const dataMode = getResolvedDataMode();
  const mode = auth.mode === "local" || dataMode === "local" ? "local" : "supabase";

  try {
    const catalog =
      mode === "local"
        ? { items: menuItems, categories: getCategoriesInUse(), branchId }
        : await loadManageableCatalog(branchId);

    const screen =
      catalog.items.length === 0 ? (
        <EmptyState
          title="Catálogo vacío"
          description="No hay platos publicados para administrar en esta sucursal."
        />
      ) : (
        <DishesScreen
          mode={mode}
          branchId={catalog.branchId}
          items={catalog.items}
          categories={catalog.categories}
        />
      );

    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/empleado" className="text-sm font-semibold text-lime underline-offset-4 hover:underline">
            ← Volver a operación
          </Link>
          <Link
            href="/empleado/catalogo/categorias"
            className="text-sm font-semibold text-muted underline-offset-4 hover:underline"
          >
            Categorías
          </Link>
        </div>
        <AdminRoleProvider mode={mode} role={auth.role}>
          {screen}
        </AdminRoleProvider>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof CatalogReadError
        ? error.message
        : "No pudimos cargar el catálogo operativo.";
    return <EmptyState title="Error al cargar catálogo" description={message} />;
  }
}
