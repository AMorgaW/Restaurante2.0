"use client";

import { AlertTriangle, PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { getInventoryStatus, INVENTORY_STATUS_LABELS } from "@/lib/inventory/selectors";
import { getQuickInventoryItems } from "@/lib/employee/selectors";
import type { InventoryItem } from "@/lib/inventory/types";

export function EmployeeQuickInventory({
  items,
  mode = "local",
  loadError = null,
}: {
  items: InventoryItem[];
  mode?: "local" | "supabase";
  loadError?: string | null;
}) {
  const critical = getQuickInventoryItems(items);
  return (
    <section id="inventario" aria-labelledby="empleado-inventario" className="scroll-mt-5 rounded-card border border-border-soft bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-action/15 text-action">
          <PackageSearch aria-hidden className="size-5" />
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Consulta rápida</p>
          <h2 id="empleado-inventario" className="mt-1 text-xl font-extrabold">
            Inventario operativo
          </h2>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {mode === "supabase"
          ? "Solo lectura desde PostgreSQL: insumos que pueden bloquear la preparación."
          : "Solo lectura: revisa insumos que pueden bloquear la preparación."}
      </p>
      {loadError ? (
        <EmptyState title="No se pudo cargar el inventario" description={loadError} className="px-0 py-8" />
      ) : critical.length === 0 ? (
        <EmptyState
          title="Sin alertas críticas"
          description={
            mode === "supabase"
              ? items.length === 0
                ? "No hay insumos visibles para tu sucursal."
                : "No hay insumos agotados o críticos en PostgreSQL."
              : "No hay insumos agotados o críticos en el demo local."
          }
          className="px-0 py-8"
        />
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {critical.map((item) => {
            const status = getInventoryStatus(item);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-background-secondary/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.quantity.toLocaleString("es-CO")} {item.unit} · mínimo{" "}
                    {item.minimumQuantity.toLocaleString("es-CO")} {item.unit}
                  </p>
                </div>
                <Badge variant={status === "out" ? "error" : "warning"}>
                  <AlertTriangle aria-hidden className="size-3" /> {INVENTORY_STATUS_LABELS[status]}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">No permite entradas, ajustes, mermas, recetas ni reversas.</p>
    </section>
  );
}
