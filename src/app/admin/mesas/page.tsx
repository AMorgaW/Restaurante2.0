import type { Metadata } from "next";
import { DiningTablesAdminScreen } from "@/components/dining-tables/dining-tables-admin-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { getResolvedDataMode } from "@/lib/env/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadDiningTablesForUi } from "@/server/dining-tables/load";
import { branches as configBranches } from "@/config/restaurant";

export const metadata: Metadata = {
  title: "Mesas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function loadBranchOptions(): Promise<Array<{ id: string; label: string }>> {
  if (getResolvedDataMode() !== "supabase") {
    return configBranches
      .filter((branch) => branch.status === "active")
      .map((branch, index) => ({
        // UUIDs estables solo para demo local (el schema de create exige uuid).
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        label: branch.name,
      }));
  }

  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client
      .from("branches")
      .select("id, slug, name")
      .eq("status", "active")
      .order("name");
    if (error || !data) return [];
    return (data as Array<{ id: string; slug: string; name: string }>).map((row) => ({
      id: row.id,
      label: row.name || row.slug || row.id,
    }));
  } catch {
    return [];
  }
}

export default async function AdminMesasPage() {
  const auth = await authorizeAdminSection("tables");
  const loaded = await loadDiningTablesForUi({ includeInactive: true });
  const branchOptions = await loadBranchOptions();
  const role = auth.role === "admin" ? "admin" : "owner";

  return (
    <DiningTablesAdminScreen
      tables={loaded.tables}
      loadError={loaded.error}
      role={role}
      branchOptions={branchOptions}
    />
  );
}
