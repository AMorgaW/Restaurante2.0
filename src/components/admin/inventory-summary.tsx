import { AlertTriangle, CheckCircle2, CircleDollarSign, PackageCheck, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format/currency";
import type { InventorySummary as InventorySummaryData } from "@/lib/inventory/types";

const SUMMARY_ITEMS = [
  { key: "active", label: "Insumos activos", icon: PackageCheck, className: "text-lime" },
  { key: "low", label: "Stock bajo", icon: AlertTriangle, className: "text-warning" },
  { key: "critical", label: "Críticos", icon: XCircle, className: "text-orange-300" },
  { key: "out", label: "Agotados", icon: XCircle, className: "text-error" },
] as const;

export function InventorySummary({ summary }: { summary: InventorySummaryData }) {
  return (
    <section aria-labelledby="inventario-resumen" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <h2 id="inventario-resumen" className="sr-only">Resumen de inventario</h2>
      {SUMMARY_ITEMS.map(({ key, label, icon: Icon, className }) => (
        <div key={key} className="rounded-card border border-border-soft bg-surface p-4">
          <Icon aria-hidden className={`size-5 ${className}`} />
          <p className="mt-3 text-2xl font-extrabold tabular-nums">{summary[key]}</p>
          <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
        </div>
      ))}
      <div className="col-span-2 rounded-card border border-lime/30 bg-surface p-4 md:col-span-1">
        <CircleDollarSign aria-hidden className="size-5 text-action" />
        <p className="mt-3 text-xl font-extrabold tabular-nums">{formatCurrency(summary.estimatedValue)}</p>
        <p className="mt-1 text-xs font-semibold text-muted">Valor estimado</p>
      </div>
      <div className="col-span-2 rounded-card border border-border-soft bg-white/4 p-3 md:col-span-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 aria-hidden className="size-4 text-lime" />
          Consumo de inventario hoy: <span className="text-foreground">{summary.consumptionToday.toLocaleString("es-CO")} unidades mixtas</span>
        </div>
      </div>
    </section>
  );
}
