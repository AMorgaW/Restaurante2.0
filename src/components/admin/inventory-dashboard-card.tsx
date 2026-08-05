"use client";

import { ArrowRight, CircleAlert, PackageSearch, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format/currency";
import { getInventoryStatus, getMovementLabel } from "@/lib/inventory/selectors";
import type { InventoryItem, InventorySummary } from "@/lib/inventory/types";

export function InventoryDashboardCard({ items, summary }: { items: InventoryItem[]; summary: InventorySummary }) {
  const urgent = items.filter((item) => ["critical", "out"].includes(getInventoryStatus(item))).slice(0, 3);
  return (
    <section aria-labelledby="dashboard-inventario" className="rounded-card border border-lime/30 bg-gradient-to-br from-[#112c8b]/80 to-[#06164f]/90 p-4 shadow-card md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Prioridad operativa</p>
          <h2 id="dashboard-inventario" className="mt-1 flex items-center gap-2 text-xl font-extrabold"><PackageSearch aria-hidden className="size-5 text-lime" /> Inventario</h2>
          <p className="mt-1 text-sm text-muted">Control de insumos, existencias y movimientos locales.</p>
        </div>
        <Link href="/admin/inventario" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-bold text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime">Ver inventario <ArrowRight aria-hidden className="size-4" /></Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl bg-black/15 p-3"><p className="text-2xl font-extrabold tabular-nums">{summary.active}</p><p className="text-xs text-muted">Activos</p></div>
        <div className="rounded-2xl bg-black/15 p-3"><p className="text-2xl font-extrabold tabular-nums text-warning">{summary.low}</p><p className="text-xs text-muted">Stock bajo</p></div>
        <div className="rounded-2xl bg-black/15 p-3"><p className="text-2xl font-extrabold tabular-nums text-orange-300">{summary.critical + summary.out}</p><p className="text-xs text-muted">Críticos/agotados</p></div>
        <div className="rounded-2xl bg-black/15 p-3"><p className="text-lg font-extrabold tabular-nums">{formatCurrency(summary.estimatedValue)}</p><p className="text-xs text-muted">Valor estimado</p></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-white/8 bg-black/10 p-3">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Alertas de stock</h3><span className="text-xs text-muted">{urgent.length ? `${urgent.length} para revisar` : "Sin alertas críticas"}</span></div>
          {urgent.length ? <ul className="mt-2 flex flex-wrap gap-2">{urgent.map((item) => <li key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-error/40 bg-error/10 px-2.5 py-1 text-xs font-semibold text-error"><CircleAlert aria-hidden className="size-3.5" />{item.name}</li>)}</ul> : <p className="mt-2 text-xs text-muted">Todos los insumos críticos están controlados.</p>}
        </div>
        <div className="flex flex-wrap gap-2 md:flex-col">
          <Link href="/admin/inventario" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-3.5 text-sm font-bold text-lime focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"><Plus aria-hidden className="size-4" /> Agregar insumo</Link>
          <Link href="/admin/inventario" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border-soft bg-white/5 px-3.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"><ReceiptText aria-hidden className="size-4" /> Ingresar cantidad</Link>
        </div>
      </div>
      {summary.recentMovements.length ? <div className="mt-4 border-t border-white/10 pt-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Actividad reciente</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{summary.recentMovements.slice(0, 2).map((movement) => <li key={movement.id} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-muted">{getMovementLabel(movement.type)}</span><span className="shrink-0 font-semibold text-foreground">{movement.quantity.toLocaleString("es-CO")}</span></li>)}</ul></div> : null}
    </section>
  );
}
