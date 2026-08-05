import "server-only";

import { redirect } from "next/navigation";
import { canAccessAdminSection, isAdminRole, type AdminRole, type AdminSection } from "@/lib/admin/authorization";
import { getAuthModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";

export async function authorizeAdminSection(section: AdminSection): Promise<{
  mode: "local" | "supabase" | "unavailable";
  role: AdminRole | null;
}> {
  const status = getAuthModeStatus();
  if (status.mode === "disabled") return { mode: "local", role: null };
  if (status.mode !== "supabase" || !status.configured) return { mode: "unavailable", role: null };

  const session = await resolveServerSession();
  if (session.kind === "anonymous") redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (!session.profile || !isAdminRole(session.profile.role) || !["owner", "admin"].includes(session.kind) || !canAccessAdminSection(session.profile.role, section)) {
    if (section === "dashboard") redirect("/cuenta?error=admin");
    redirect(`/admin?error=forbidden&section=${encodeURIComponent(section)}`);
  }
  return { mode: "supabase", role: session.profile.role as AdminRole };
}
