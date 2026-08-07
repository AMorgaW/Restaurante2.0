import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { isAdminRole } from "@/lib/admin/authorization";
import { getAuthModeStatus, getDataModeStatus } from "@/lib/env/server";
import { resolveServerSession } from "@/lib/session/server-resolver";

export const metadata: Metadata = {
  title: {
    default: "Administración",
    template: "%s · Admin",
  },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const status = getAuthModeStatus();
  const dataStatus = getDataModeStatus();
  if (dataStatus.mode === "invalid" || (dataStatus.mode === "supabase" && !dataStatus.configured)) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <main className="w-full max-w-lg rounded-card border border-border-soft bg-surface p-6">
          <h1 className="text-xl font-extrabold">Configuracion de datos invalida</h1>
          <p role="alert" className="mt-2 text-sm leading-relaxed text-muted">
            El panel permanece cerrado hasta corregir DATA_MODE y su configuracion de Supabase.
          </p>
        </main>
      </div>
    );
  }
  const dataMode = dataStatus.mode === "supabase" ? "supabase" : "local";
  if (status.mode === "disabled") return <AdminShell mode="local" dataMode={dataMode}>{children}</AdminShell>;

  if (!status.configured) {
    const issues = [...status.missing, ...status.invalid];
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg rounded-card border border-border-soft bg-surface p-6">
          <h1 className="text-xl font-extrabold">Supabase no está configurado</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Auth permanece cerrado por una configuracion invalida o incompleta: {issues.join(", ") || "AUTH_MODE"}.
            Configúralas en el entorno del servidor para acceder a administración.
          </p>
        </div>
      </div>
    );
  }

  const session = await resolveServerSession();
  if (session.kind === "anonymous") redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (session.kind === "suspended_staff") redirect("/cuenta?error=admin");
  if (
    !session.profile ||
    !isAdminRole(session.profile.role) ||
    (session.kind !== "owner" && session.kind !== "admin")
  ) {
    redirect("/cuenta?error=admin");
  }

  return (
    <AdminShell mode="supabase" dataMode={dataMode} role={session.profile.role}>
      {children}
    </AdminShell>
  );
}
