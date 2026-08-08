"use client";

import { ArrowLeft, Armchair } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatCurrency } from "@/lib/format/currency";
import type { DiningTableListItem } from "@/types/dining-tables";

const STATUS_LABEL: Record<"free" | "open_account", string> = {
  free: "Libre",
  open_account: "Cuenta abierta",
};

const STATUS_BADGE: Record<"free" | "open_account", "success" | "warning"> = {
  free: "success",
  open_account: "warning",
};

type OpsVisibleTable = DiningTableListItem & {
  operationalStatus: "free" | "open_account";
};

function isOpsVisible(table: DiningTableListItem): table is OpsVisibleTable {
  return table.isActive && (table.operationalStatus === "free" || table.operationalStatus === "open_account");
}

export function DiningTablesOpsScreen({
  tables,
  loadError,
  canConfirm,
  canVoid,
  canManage = false,
  basePath = "/empleado/mesas",
  backHref = "/empleado",
}: {
  tables: DiningTableListItem[];
  loadError: string | null;
  canConfirm: boolean;
  canVoid: boolean;
  canManage?: boolean;
  basePath?: string;
  backHref?: string;
}) {
  const visible = tables.filter(isOpsVisible);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"
          >
            <ArrowLeft aria-hidden className="size-4" /> Volver
          </Link>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
            Brisas del Sinú · Operación
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <Armchair aria-hidden className="size-7 text-lime" /> Mesas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Consulta mesas libres y cuentas abiertas.
            {canConfirm ? " Puedes confirmar cobros desde la cuenta." : ""}
            {canVoid ? " Puedes anular cobros activos." : ""}
            {canManage ? " La gestión de QR está en administración." : ""}
          </p>
        </div>
        {canManage ? (
          <Link
            href="/admin/mesas"
            className="inline-flex min-h-11 items-center rounded-button border border-border-soft bg-surface px-4 text-sm font-semibold hover:border-lime/50"
          >
            Administrar mesas
          </Link>
        ) : null}
      </header>

      {loadError ? (
        <p role="alert" className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {loadError}
        </p>
      ) : null}

      {visible.length === 0 && !loadError ? (
        <EmptyState
          title="No hay mesas activas"
          description="Cuando haya mesas activas o cuentas abiertas, aparecerán aquí."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((table) => {
            const status = table.operationalStatus;
            return (
            <li
              key={table.tableId}
              className="flex flex-col gap-3 rounded-card border border-border-soft bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
                    {table.code}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-extrabold">
                    {table.name?.trim() || `Mesa ${table.code}`}
                  </h2>
                </div>
                <Badge variant={STATUS_BADGE[status]}>
                  {STATUS_LABEL[status]}
                </Badge>
              </div>

              {status === "open_account" ? (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">Pedidos</dt>
                    <dd className="font-semibold">{table.orderCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Pendiente</dt>
                    <dd className="font-semibold">{formatCurrency(table.outstandingTotal)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted">Lista para recibir comensales.</p>
              )}

              {table.openSessionId ? (
                <Link
                  href={`${basePath}/cuenta/${table.openSessionId}`}
                  className="mt-auto inline-flex min-h-11 items-center justify-center rounded-button bg-action px-4 text-sm font-bold text-action-foreground"
                >
                  Ver cuenta
                </Link>
              ) : null}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
