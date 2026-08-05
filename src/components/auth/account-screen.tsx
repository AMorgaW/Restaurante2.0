"use client";

import Link from "next/link";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { PENSION_DEMO_MEMBERSHIPS, PENSION_DEMO_PROFILES } from "@/lib/pension/fixtures";
import { resolveDemoSession } from "@/lib/session/demo-resolver";
import { useAdminStore } from "@/stores/admin";
import { usePensionStore, resetPensionDemo } from "@/stores/pension";
import { useStaffStore, resetStaffDemo } from "@/stores/staff";

export function AccountDemoScreen() {
  const admin = useAdminStore();
  const pension = usePensionStore();
  const staff = useStaffStore();
  const session = resolveDemoSession({
    demoSessionActive: admin.demoSessionActive || pension.demoSessionActive,
    demoRole: admin.demoRole,
    selectedEmployeeId: staff.selectedEmployeeId,
    staffMembers: staff.members,
    selectedProfileId: pension.selectedProfileId,
    pensionProfiles: PENSION_DEMO_PROFILES,
    memberships: PENSION_DEMO_MEMBERSHIPS,
  });
  function logout() {
    admin.logout();
    resetPensionDemo();
    resetStaffDemo();
  }
  const label = session.kind === "anonymous" ? "Visitante" : session.kind === "customer_with_membership" ? "Cliente con plan" : session.kind === "customer_without_membership" ? "Cliente" : session.kind === "suspended_staff" ? "Acceso suspendido" : "Personal autorizado";
  return (
    <AuthPageShell>
      <section className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6" aria-labelledby="account-demo-title">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Demo local</p>
        <h1 id="account-demo-title" className="mt-2 text-2xl font-extrabold">Mi cuenta</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{label}. La demo no representa una sesión de Auth real.</p>
        {session.profile ? <dl className="mt-5 grid gap-3 text-sm"><div><dt className="font-semibold text-muted">Nombre</dt><dd>{session.profile.name ?? "Sin nombre"}</dd></div><div><dt className="font-semibold text-muted">Correo</dt><dd>{session.email ?? "No disponible"}</dd></div><div><dt className="font-semibold text-muted">Acceso principal</dt><dd>{session.destination}</dd></div></dl> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {session.kind === "anonymous" ? <Link href="/login" className="rounded-full bg-action px-5 py-3 text-sm font-extrabold text-action-foreground">Iniciar sesión</Link> : <><Link href={session.destination} className="rounded-full bg-action px-5 py-3 text-sm font-extrabold text-action-foreground">Ir a mi espacio</Link><button type="button" onClick={logout} className="rounded-full border border-border-soft px-5 py-3 text-sm font-bold">Cerrar demo</button></>}
          <Link href="/menu" className="rounded-full border border-border-soft px-5 py-3 text-sm font-bold">Ver menú</Link>
        </div>
      </section>
    </AuthPageShell>
  );
}
