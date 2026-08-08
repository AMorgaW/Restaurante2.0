import type { Metadata } from "next";
import { TableSessionAccountScreen } from "@/components/dining-tables/table-session-account-screen";
import { isAdminRole } from "@/lib/admin/authorization";
import { authorizeAdminSection } from "@/lib/admin/server-authorization";
import {
  loadManualPaymentHistoryForUi,
  loadTableSessionAccountForUi,
} from "@/server/dining-tables/load";
import {
  canConfirmManualPayments,
  canVoidManualPayments,
} from "@/server/dining-tables/service";

export const metadata: Metadata = {
  title: "Cuenta de mesa",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMesaCuentaPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const auth = await authorizeAdminSection("tables");
  const { sessionId } = await params;
  const accountLoaded = await loadTableSessionAccountForUi(sessionId);
  const historyLoaded = accountLoaded.account
    ? await loadManualPaymentHistoryForUi({
        targetType: "table_session",
        targetId: sessionId,
      })
    : { history: [], error: null as string | null };

  const role = isAdminRole(auth.role) ? auth.role : "owner";

  return (
    <TableSessionAccountScreen
      account={accountLoaded.account}
      history={historyLoaded.history}
      loadError={accountLoaded.error ?? historyLoaded.error}
      canConfirm={canConfirmManualPayments(role)}
      canVoid={canVoidManualPayments(role)}
      basePath="/admin/mesas"
    />
  );
}
