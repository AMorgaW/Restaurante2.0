import type { Metadata } from "next";
import { EmployeeWorkspace } from "@/components/employee/employee-workspace";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { redirect } from "next/navigation";
import { isEmployeeRole } from "@/lib/employee/authorization";
import { loadOperationalOrdersForUi } from "@/server/orders/load-operational-orders";
import { adminRoleCan } from "@/lib/admin/authorization";

export const metadata: Metadata = {
  title: "Operación de empleado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EmployeePage() {
  const auth = getAuthModeStatus();
  if (auth.mode === "supabase" && auth.configured) {
    const session = await resolveServerSession();
    if (session.kind === "anonymous") redirect("/login?next=%2Fempleado");
    if (!isEmployeeRole(session.profile?.role) || !["manager", "kitchen", "cashier", "editor", "support"].includes(session.kind)) {
      redirect("/cuenta?error=employee");
    }

    const canReadOrders = adminRoleCan(session.profile.role, "read-orders");
    const loaded = canReadOrders
      ? await loadOperationalOrdersForUi()
      : { mode: "supabase" as const, orders: [], error: null };

    return (
      <EmployeeWorkspace
        initialSnapshot={createServiceSnapshot(new Date())}
        mode="supabase"
        supabaseRole={session.profile.role}
        supabaseProfile={session.profile}
        operationalOrders={loaded.mode === "supabase" ? loaded.orders : []}
        ordersError={loaded.mode === "supabase" ? loaded.error : null}
      />
    );
  }
  return <EmployeeWorkspace initialSnapshot={createServiceSnapshot(new Date())} mode={auth.mode === "disabled" ? "local" : "closed"} />;
}
