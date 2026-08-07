import "server-only";

import { getResolvedDataMode } from "@/lib/env/server";
import {
  loadAdminPensionSnapshot,
  loadCustomerPensionSnapshot,
} from "@/server/pension/service";
import type { PensionAdminSnapshot, PensionCustomerSnapshot } from "@/server/pension/types";

const emptyCustomerSnapshot = (): PensionCustomerSnapshot => ({
  membership: null,
  plans: [],
  menusByDate: {},
  deliveryFee: null,
  consumptions: [],
  branchId: null,
  branchSlug: null,
  commercialDate: null,
});

const emptyAdminSnapshot = (): PensionAdminSnapshot => ({
  memberships: [],
  plans: [],
  menus: [],
  branches: [],
  catalogMenuItems: [],
});

export async function loadCustomerPensionForUi(
  userId: string,
): Promise<
  | { mode: "supabase"; snapshot: PensionCustomerSnapshot; error: null }
  | { mode: "supabase"; snapshot: PensionCustomerSnapshot; error: string }
  | { mode: "local"; snapshot: PensionCustomerSnapshot; error: string }
> {
  if (getResolvedDataMode() !== "supabase") {
    return {
      mode: "local",
      snapshot: emptyCustomerSnapshot(),
      error: "El plan pensionado remoto solo está disponible con DATA_MODE=supabase.",
    };
  }
  try {
    const snapshot = await loadCustomerPensionSnapshot(userId);
    return { mode: "supabase", snapshot, error: null };
  } catch {
    return {
      mode: "supabase",
      snapshot: emptyCustomerSnapshot(),
      error: "No se pudo cargar tu plan pensionado. Intenta de nuevo.",
    };
  }
}

export async function loadAdminPensionForUi(options?: {
  search?: string;
  branchId?: string;
}): Promise<
  | { mode: "supabase"; snapshot: PensionAdminSnapshot; error: null }
  | { mode: "supabase"; snapshot: PensionAdminSnapshot; error: string }
  | { mode: "local"; snapshot: PensionAdminSnapshot; error: string }
> {
  if (getResolvedDataMode() !== "supabase") {
    return {
      mode: "local",
      snapshot: emptyAdminSnapshot(),
      error: "La administración pensionada remota solo está disponible con DATA_MODE=supabase.",
    };
  }
  try {
    const snapshot = await loadAdminPensionSnapshot(options);
    return { mode: "supabase", snapshot, error: null };
  } catch {
    return {
      mode: "supabase",
      snapshot: emptyAdminSnapshot(),
      error: "No se pudo cargar la gestión de pensionados. Intenta de nuevo.",
    };
  }
}
