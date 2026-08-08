import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TableSessionAccountScreen } from "@/components/dining-tables/table-session-account-screen";
import { isAdminRole, type AdminRole } from "@/lib/admin/authorization";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import {
  loadManualPaymentHistoryForUi,
  loadTableSessionAccountForUi,
} from "@/server/dining-tables/load";
import {
  canConfirmManualPayments,
  canVoidManualPayments,
} from "@/server/dining-tables/service";

export const metadata: Metadata = {
  title: "Cuenta de mesa · Empleado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MESAS_ROLES = new Set<AdminRole>(["owner", "admin", "manager", "cashier"]);

export default async function EmpleadoMesaCuentaPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
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

  const { sessionId } = await params;
  const accountLoaded = await loadTableSessionAccountForUi(sessionId);
  const historyLoaded = accountLoaded.account
    ? await loadManualPaymentHistoryForUi({
        targetType: "table_session",
        targetId: sessionId,
      })
    : { history: [], error: null as string | null };

  return (
    <TableSessionAccountScreen
      account={accountLoaded.account}
      history={historyLoaded.history}
      loadError={accountLoaded.error ?? historyLoaded.error}
      canConfirm={canConfirmManualPayments(role)}
      canVoid={canVoidManualPayments(role)}
      basePath="/empleado/mesas"
    />
  );
}
