import "server-only";

import { getResolvedDataMode } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDefaultConfiguredBranch } from "@/server/catalog/branch-config";

/**
 * UUID demo estable para DATA_MODE=local (el schema de create exige uuid).
 * Coincide con el índice 0 de sucursales activas que usaba la UI anterior.
 */
const LOCAL_CANONICAL_BRANCH_UUID = "00000000-0000-4000-8000-000000000001";

type BranchIdRow = { id: string };

/**
 * Resuelve la sucursal canónica en servidor para crear mesas.
 * No confía en branch_id enviado por el navegador.
 */
export async function resolveCanonicalDiningBranchId(): Promise<string | null> {
  if (getResolvedDataMode() !== "supabase") {
    return LOCAL_CANONICAL_BRANCH_UUID;
  }

  try {
    const client = await createServerSupabaseClient();
    const preferredSlug = getDefaultConfiguredBranch().slug;

    const { data: preferred, error: preferredError } = await client
      .from("branches")
      .select("id")
      .eq("status", "active")
      .eq("slug", preferredSlug)
      .maybeSingle();

    const preferredRow = preferred as BranchIdRow | null;
    if (!preferredError && preferredRow && typeof preferredRow.id === "string") {
      return preferredRow.id;
    }

    const { data, error } = await client
      .from("branches")
      .select("id")
      .eq("status", "active")
      .order("name")
      .limit(1);

    const rows = (data ?? []) as BranchIdRow[];
    if (error || !rows[0] || typeof rows[0].id !== "string") {
      return null;
    }
    return rows[0].id;
  } catch {
    return null;
  }
}
