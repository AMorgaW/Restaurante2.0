import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiningTablesOpsScreen } from "@/components/dining-tables/dining-tables-ops-screen";
import { isAdminRole, type AdminRole } from "@/lib/admin/authorization";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { loadDiningTablesForUi } from "@/server/dining-tables/load";
import {
  canConfirmManualPayments,
  canManageDiningTables,
  canVoidManualPayments,
} from "@/server/dining-tables/service";

export const metadata: Metadata = {
  title: "Mesas · Empleado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESAS_ROLES = new Set<AdminRole>(["owner", "admin", "manager", "cashier"]);

export default async function EmpleadoMesasPage() {
  const auth = getAuthModeStatus();
  let role: AdminRole = "owner";

  if (auth.mode === "disabled") {
    role = "owner";
  } else if (auth.mode === "supabase" && auth.configured) {
    const session = await resolveServerSession();
    if (session.kind === "anonymous") {
      redirect(`/login?next=${encodeURIComponent("/empleado/mesas")}`);
    }
    if (session.kind === "suspended_staff") {
      redirect("/cuenta?error=employee");
    }
    const profileRole = session.profile?.role;
    if (
      !session.profile ||
      !isAdminRole(profileRole) ||
      !MESAS_ROLES.has(profileRole) ||
      !["owner", "admin", "manager", "cashier"].includes(session.kind)
    ) {
      redirect("/empleado?error=mesas");
    }
    role = profileRole;
  } else {
    redirect("/empleado?error=mesas");
  }

  const loaded = await loadDiningTablesForUi({ includeInactive: false });

  return (
    <DiningTablesOpsScreen
      tables={loaded.tables}
      loadError={loaded.error}
      canConfirm={canConfirmManualPayments(role)}
      canVoid={canVoidManualPayments(role)}
      canManage={canManageDiningTables(role)}
      basePath="/empleado/mesas"
      backHref="/empleado"
    />
  );
}
