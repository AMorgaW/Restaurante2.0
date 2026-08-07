"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { PensionHeader } from "@/components/pension/pension-header";
import { PensionHistory } from "@/components/pension/pension-history";
import { PensionMenuSelector } from "@/components/pension/pension-menu-selector";
import { PensionPlanCard } from "@/components/pension/pension-plan-card";
import { PensionStatePanel } from "@/components/pension/pension-state-panel";
import { SkipLink } from "@/components/ui/skip-link";
import { useMounted } from "@/hooks/use-mounted";
import { getPensionMembershipStatus, getPensionRemaining, resolvePensionContext } from "@/lib/pension/selectors";
import type { ServiceSnapshot } from "@/lib/menu/service-period";
import { useAdminStore } from "@/stores/admin";
import { usePensionStore } from "@/stores/pension";
import { usePensionAdminStore } from "@/stores/pension-admin";
import { resetPensionDemo } from "@/stores/pension";
import { resetStaffDemo } from "@/stores/staff";

const DEMO_OPTIONS = [
  ["customer-no-membership", "Sin membresía"],
  ["customer-pending", "Pendiente"],
  ["customer-active", "Activo"],
  ["customer-suspended", "Suspendido"],
  ["customer-expired", "Vencido"],
  ["customer-cancelled", "Cancelado"],
] as const;

/** Local/closed demo workspace. Supabase path renders `PensionSupabaseWorkspace` from the page. */
export function PensionWorkspace({
  initialSnapshot,
  mode,
  requireDemoSession = false,
}: {
  initialSnapshot: ServiceSnapshot;
  mode: "local" | "closed" | "supabase";
  requireDemoSession?: boolean;
}) {
  const mounted = useMounted();
  const demoRole = useAdminStore((state) => state.demoRole);
  const selectedProfileId = usePensionStore((state) => state.selectedProfileId);
  const demoSessionActive = usePensionStore((state) => state.demoSessionActive);
  const setDemoProfile = usePensionStore((state) => state.setDemoProfile);
  const consumptions = usePensionStore((state) => state.consumptions);
  const mealBalances = usePensionStore((state) => state.mealBalances);
  const memberships = usePensionAdminStore((state) => state.memberships);
  const context = useMemo(() => {
    const base = resolvePensionContext(selectedProfileId, memberships);
    if (!base?.membership?.modality) return base;
    return { ...base, plan: { ...base.plan, modality: base.membership.modality } };
  }, [memberships, selectedProfileId]);
  const membership = context?.membership
    ? {
        ...context.membership,
        ...(mealBalances[context.membership.id] !== undefined
          ? { mealsAvailable: mealBalances[context.membership.id] }
          : {}),
      }
    : null;

  if (mode === "supabase") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <main
          id="contenido"
          className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6 text-center"
        >
          <h1 className="text-2xl font-extrabold">Plan pensionado</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-muted">
            La experiencia remota se renderiza desde la página con DATA_MODE=supabase.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 items-center rounded-button bg-action px-5 font-bold text-action-foreground"
          >
            Volver
          </Link>
        </main>
      </div>
    );
  }

  if (mode === "closed") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <main
          id="contenido"
          className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6 text-center"
        >
          <h1 className="text-2xl font-extrabold">Experiencia pensionado cerrada</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-muted">
            La cuenta real y la resolución de membresía se habilitarán con Auth en la Etapa 6.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex min-h-11 items-center rounded-button bg-action px-5 font-bold text-action-foreground"
          >
            Volver
          </Link>
        </main>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div aria-busy="true" className="flex min-h-dvh items-center justify-center px-5">
        <div className="skeleton h-64 w-full max-w-4xl rounded-card" />
      </div>
    );
  }

  if (
    (requireDemoSession && !demoSessionActive) ||
    demoRole ||
    !context ||
    context.profile.role !== "customer"
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5 py-10">
        <main
          id="contenido"
          className="w-full max-w-md rounded-card border border-border-soft bg-surface p-6 text-center"
        >
          <ShieldAlert aria-hidden className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 text-2xl font-extrabold">Acceso de cliente demo requerido</h1>
          <p role="alert" className="mt-3 text-sm leading-relaxed text-muted">
            Pensionado es una condición comercial de customer; no concede beneficios a cargos
            administrativos o de empleado.
          </p>
          <Link
            href={requireDemoSession ? "/login" : "/cuenta"}
            className="mt-5 inline-flex min-h-11 items-center rounded-button border border-border-soft px-4 font-bold"
          >
            {requireDemoSession ? "Iniciar sesión demo" : "Ir a mi cuenta"}
          </Link>
        </main>
      </div>
    );
  }

  const status = getPensionMembershipStatus(membership);
  const remaining = getPensionRemaining(membership, context.plan);
  const active = status === "active" && membership !== null;
  const blockedWithHistory =
    membership !== null && ["suspended", "expired", "cancelled"].includes(status);

  function logout() {
    useAdminStore.getState().logout();
    resetPensionDemo();
    resetStaffDemo();
    window.location.assign("/login");
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <SkipLink />
      <PensionHeader
        context={context}
        membership={membership}
        remaining={remaining}
        onLogout={logout}
      />
      <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-6 pb-10 md:px-8">
        <div className="mb-5 rounded-2xl border border-lime/20 bg-lime/5 p-3 text-sm text-muted">
          <label className="flex flex-wrap items-center gap-3 font-semibold">
            <span>Perfil demo local</span>
            <select
              aria-label="Perfil demo local"
              value={selectedProfileId}
              onChange={(event) => setDemoProfile(event.target.value)}
              className="min-h-10 rounded-xl border border-border-soft bg-surface px-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-lime"
            >
              {DEMO_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="text-xs">No modifica Auth ni activa cuentas reales.</span>
          </label>
        </div>
        <div className="grid gap-6">
          {!membership ? (
            <PensionStatePanel context={context} membership={membership} />
          ) : !active ? (
            <>
              <PensionStatePanel context={context} membership={membership} />
              {blockedWithHistory ? (
                <PensionHistory
                  membership={membership}
                  plan={context.plan}
                  consumptions={consumptions.filter(
                    (consumption) => consumption.membershipId === membership.id,
                  )}
                />
              ) : null}
            </>
          ) : (
            <>
              <PensionPlanCard context={context} membership={membership} />
              <PensionMenuSelector observedAt={initialSnapshot.observedAt} />
              <PensionHistory
                membership={membership}
                plan={context.plan}
                consumptions={consumptions.filter(
                  (consumption) => consumption.membershipId === membership.id,
                )}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
