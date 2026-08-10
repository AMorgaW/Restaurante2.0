import type { Metadata } from "next";
import { DiningTablesAdminScreen } from "@/components/dining-tables/dining-tables-admin-screen";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import { resolveCanonicalDiningBranchId } from "@/server/dining-tables/canonical-branch";
import { loadDiningTablesForUi } from "@/server/dining-tables/load";

export const metadata: Metadata = {
  title: "Mesas",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMesasPage() {
  const auth = await authorizeAdminSection("tables");
  const loaded = await loadDiningTablesForUi({ includeInactive: true });
  const canonicalBranchId = await resolveCanonicalDiningBranchId();
  const role = auth.role === "admin" ? "admin" : "owner";

  return (
    <DiningTablesAdminScreen
      tables={loaded.tables}
      loadError={loaded.error}
      role={role}
      canCreate={Boolean(canonicalBranchId)}
    />
  );
}
