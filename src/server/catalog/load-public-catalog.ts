import "server-only";

import { getResolvedDataMode } from "@/lib/env/server";
import { getDefaultConfiguredBranch } from "@/server/catalog/branch-config";
import { getMenuRepository } from "@/server/repositories";
import type { CategoryInfo, MenuItem } from "@/types/menu";

export type PublicCatalog = {
  mode: "local" | "supabase";
  branchId: string;
  items: MenuItem[];
  categories: CategoryInfo[];
  /** Solo DATA_MODE=local puede aplicar overrides demo del panel. */
  allowDemoOverrides: boolean;
};

/**
 * Carga el catálogo público autoritativo para la sucursal por defecto
 * (o la indicada). Checkout vuelve a consultar el repositorio en servidor.
 */
export async function loadPublicCatalog(branchId?: string): Promise<PublicCatalog> {
  const mode = getResolvedDataMode();
  const resolvedBranchId = branchId ?? getDefaultConfiguredBranch().id;
  const repository = getMenuRepository();
  const [items, categories] = await Promise.all([
    repository.getMenuItems({ branchId: resolvedBranchId }),
    repository.getCategories(),
  ]);
  return {
    mode,
    branchId: resolvedBranchId,
    items,
    categories,
    allowDemoOverrides: mode === "local",
  };
}

export async function loadPublicMenuItem(slug: string, branchId?: string): Promise<{
  mode: "local" | "supabase";
  branchId: string;
  item: MenuItem | null;
  items: MenuItem[];
  allowDemoOverrides: boolean;
}> {
  const catalog = await loadPublicCatalog(branchId);
  const item = await getMenuRepository().getMenuItemBySlug(slug, { branchId: catalog.branchId });
  return {
    mode: catalog.mode,
    branchId: catalog.branchId,
    item,
    items: catalog.items,
    allowDemoOverrides: catalog.allowDemoOverrides,
  };
}
