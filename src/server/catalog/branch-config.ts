import { branches, restaurantConfig } from "@/config/restaurant";
import type { Branch } from "@/types/restaurant";

/**
 * Sucursal canónica de la app (configuración comercial).
 * En DATA_MODE=supabase el slug se resuelve contra `public.branches`
 * para precios/disponibilidad; los IDs de UI siguen siendo los de config
 * (`branch-centro`, etc.) hasta que exista un directorio remoto completo.
 */
export function getConfiguredBranch(branchId: string): Branch | undefined {
  return branches.find((branch) => branch.id === branchId && branch.status === "active");
}

export function getDefaultConfiguredBranch(): Branch {
  const configured = getConfiguredBranch(restaurantConfig.defaultBranchId) ?? branches.find((branch) => branch.status === "active");
  if (!configured) {
    throw new Error("No hay sucursal activa configurada en restaurantConfig.");
  }
  return configured;
}

export function requireConfiguredBranch(branchId: string): Branch {
  const branch = getConfiguredBranch(branchId);
  if (!branch) {
    throw new Error("La sucursal seleccionada no está disponible.");
  }
  return branch;
}
