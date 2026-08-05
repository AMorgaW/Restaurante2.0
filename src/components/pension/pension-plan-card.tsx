"use client";

import Link from "next/link";
import { ArrowRight, HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPensionMoney } from "@/lib/pension/pricing";
import type { PensionContext, PensionMembership } from "@/lib/pension/types";

export function PensionPlanCard({ context, membership }: { context: PensionContext; membership: PensionMembership | null }) {
  return (
    <section id="plan" aria-labelledby="plan-titulo" className="rounded-card border border-border-soft bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Información del plan</p><h2 id="plan-titulo" className="mt-1 text-2xl font-extrabold">{context.plan.name}</h2></div><Badge variant="lime">Demo local</Badge></div><p className="mt-3 text-sm leading-relaxed text-muted">{context.plan.description}</p><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted">Precio público</dt><dd className="mt-1 text-xl font-extrabold">{formatPensionMoney(context.plan.publicPrice)}</dd></div><div><dt className="text-muted">Modalidad demo</dt><dd className="mt-1 font-semibold">{context.plan.modality === "hybrid" ? "Híbrida (pendiente de definición)" : context.plan.modality}</dd></div>{membership?.agreedPrice ? <div><dt className="text-muted">Precio acordado</dt><dd className="mt-1 font-semibold">{formatPensionMoney(membership.agreedPrice)}</dd></div> : null}{membership?.discount ? <div><dt className="text-muted">Descuento registrado</dt><dd className="mt-1 font-semibold">{formatPensionMoney(membership.discount)}</dd></div> : null}</dl><div className="mt-5 rounded-2xl border border-lime/30 bg-lime/8 p-4"><p className="flex items-start gap-2 text-sm font-semibold"><HandCoins aria-hidden className="mt-0.5 size-5 shrink-0 text-lime" />El pago y la activación se realizan personalmente con el jefe.</p><p className="mt-2 text-sm text-muted">No puedes cambiar el precio ni activar beneficios desde aquí.</p></div><div className="mt-5 flex flex-wrap gap-2"><Link href="/menu" className="inline-flex min-h-11 items-center gap-2 rounded-button bg-action px-4 text-sm font-extrabold text-action-foreground">Ver menú completo <ArrowRight aria-hidden className="size-4" /></Link><Link href="/cuenta" className="inline-flex min-h-11 items-center rounded-button border border-border-soft px-4 text-sm font-bold">Mi cuenta</Link></div></section>
  );
}
