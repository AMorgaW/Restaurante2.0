import type { Metadata } from "next";
import { EmployeeWorkspace } from "@/components/employee/employee-workspace";
import { createServiceSnapshot } from "@/lib/menu/service-period";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";
import { redirect } from "next/navigation";
import { isEmployeeRole } from "@/lib/employee/authorization";

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
    if (!isEmployeeRole(session.profile?.role) || !["manager", "kitchen", "cashier", "editor", "support"].includes(session.kind)) redirect("/cuenta?error=employee");
    return <EmployeeWorkspace initialSnapshot={createServiceSnapshot(new Date())} mode="supabase" supabaseRole={session.profile.role} supabaseProfile={session.profile} />;
  }
  return <EmployeeWorkspace initialSnapshot={createServiceSnapshot(new Date())} mode={auth.mode === "disabled" ? "local" : "closed"} />;
}
