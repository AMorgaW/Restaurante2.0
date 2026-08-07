import "server-only";

import { redirect } from "next/navigation";
import { canAccessAdminSection, isAdminRole, type AdminRole, type AdminSection } from "@/lib/admin/authorization";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";

/** Roles admitidos al shell `/admin` (resto de personal usa `/empleado`). */
const ADMIN_SHELL_ROLES = new Set<AdminRole>(["owner", "admin", "manager", "editor"]);

export async function authorizeAdminSection(section: AdminSection): Promise<{
  mode: "local" | "supabase" | "unavailable";
  role: AdminRole | null;
}> {
  const status = getAuthModeStatus();
  if (status.mode === "disabled") return { mode: "local", role: null };
  if (status.mode !== "supabase" || !status.configured) return { mode: "unavailable", role: null };

  const session = await resolveServerSession();
  if (session.kind === "anonymous") redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (session.kind === "suspended_staff") redirect("/cuenta?error=admin");

  const role = session.profile?.role;
  if (!session.profile || !isAdminRole(role) || !ADMIN_SHELL_ROLES.has(role)) {
    redirect("/cuenta?error=admin");
  }
  if (!canAccessAdminSection(role, section)) {
    if (section === "dashboard") redirect("/cuenta?error=admin");
    redirect(`/admin?error=forbidden&section=${encodeURIComponent(section)}`);
  }
  return { mode: "supabase", role };
}
