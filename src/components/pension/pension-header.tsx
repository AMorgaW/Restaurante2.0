"use client";

import { CircleUserRound, LogOut, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPensionMoney } from "@/lib/pension/pricing";
import { PENSION_STATUS_LABELS } from "@/lib/pension/selectors";
import type { PensionContext, PensionMembership } from "@/lib/pension/types";

const STATUS_VARIANT: Record<PensionMembership["status"] | "none", "lime" | "success" | "warning" | "error" | "muted"> = {
  none: "muted",
  pending: "warning",
  active: "success",
  suspended: "warning",
  expired: "error",
  cancelled: "muted",
};

export function PensionHeader({ context, membership, remaining, onLogout }: { context: PensionContext; membership: PensionMembership | null; remaining: string; onLogout: () => void }) {
  const status = membership?.status ?? "none";
  return (
    <header className="border-b border-border-soft bg-background-secondary/80 px-4 pb-5 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-lime">BRISAS DEL SINÚ</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-foreground">Restaurante</p></div>
        <div className="flex items-center gap-2"><Badge variant="action"><CircleUserRound aria-hidden className="size-4" /> Pensionado</Badge><div className="hidden text-right sm:block"><p className="text-sm font-bold">{context.profile.name}</p><p className="text-xs text-muted">Cliente demo</p></div><button type="button" onClick={onLogout} aria-label="Salir de demo" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-soft px-3 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"><LogOut aria-hidden className="size-4" /> Salir</button></div>
      </div>
      <section aria-labelledby="pension-resumen" className="mx-auto mt-5 max-w-6xl rounded-card border border-border-soft bg-gradient-to-br from-cobalt/65 to-surface p-5 shadow-card md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-muted">¡Bienvenido!</p><h1 id="pension-resumen" className="mt-1 text-3xl font-extrabold">{context.profile.name}</h1><p className="mt-1 text-sm text-muted">{context.plan.name}</p><Badge className="mt-3" variant={STATUS_VARIANT[status]}>{PENSION_STATUS_LABELS[status]}</Badge></div><div className="grid min-w-[13rem] gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-background/30 p-3"><p className="text-xs text-muted">Plan</p><p className="mt-1 text-lg font-extrabold">{membership?.agreedPrice ? formatPensionMoney(membership.agreedPrice) : formatPensionMoney(context.plan.publicPrice)}</p><p className="text-xs text-muted">Precio {membership?.agreedPrice ? "acordado" : "público"}</p></div><div className="rounded-2xl border border-white/10 bg-background/30 p-3"><p className="text-xs text-muted">Estado comercial</p><p className="mt-1 text-sm font-bold text-lime">{remaining}</p><p className="text-xs text-muted">Pago y activación presenciales</p></div></div></div><p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-muted"><ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-lime" />El pago y la activación se realizan personalmente con el jefe.</p></section>
    </header>
  );
}
