"use client";

import Link from "next/link";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { useOperationalOrderMonitor } from "@/hooks/use-operational-order-monitor";
import { canReceivePendingOrderAlerts } from "@/lib/orders/operational-order-monitor";
import type { AdminRole } from "@/lib/admin/authorization";
import { cn } from "@/lib/utils";

type OperationalOrderAlertsProps = {
  role: AdminRole | null | undefined;
  enabled: boolean;
  /** Enlace a la cola de pedidos (admin o ancla empleado). */
  ordersHref: string;
  className?: string;
};

/**
 * Señal persistente + toggle de sonido para shells staff/admin.
 * El toast lo dispara el hook vía ToastProvider.
 */
export function OperationalOrderAlerts({
  role,
  enabled,
  ordersHref,
  className,
}: OperationalOrderAlertsProps) {
  const { pendingCount, soundEnabled, setSoundEnabled, lastError, active } =
    useOperationalOrderMonitor({ role, enabled });

  if (!active) return null;

  const showsPendingAlerts = canReceivePendingOrderAlerts(role);

  return (
    <div
      data-testid="operational-order-alerts"
      className={cn(
        "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface px-3 py-2.5",
        pendingCount > 0 && showsPendingAlerts && "border-warning/50 bg-warning/8",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          role="status"
          aria-live="polite"
          className="text-sm font-bold text-foreground"
          data-testid="operational-pending-count"
        >
          {showsPendingAlerts ? (
            pendingCount === 0 ? (
              "Sin pedidos pendientes de atención"
            ) : (
              <>
                Pedidos pendientes de atención:{" "}
                <span className="tabular-nums text-warning">{pendingCount}</span>
              </>
            )
          ) : (
            "Cola operativa actualizada automáticamente"
          )}
        </p>
        {lastError ? (
          <p role="status" className="mt-0.5 text-xs font-semibold text-muted">
            Última actualización falló; se mantiene el estado conocido. {lastError}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            Avisos in-web cada ~15 s · la página debe permanecer abierta
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showsPendingAlerts ? (
          <button
            type="button"
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Desactivar avisos sonoros" : "Activar avisos sonoros"}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-soft px-3 text-xs font-bold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            {soundEnabled ? (
              <Volume2 aria-hidden className="size-4 text-lime" />
            ) : (
              <VolumeX aria-hidden className="size-4" />
            )}
            Avisos sonoros
          </button>
        ) : null}
        <Link
          href={ordersHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-3 text-xs font-bold text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        >
          {pendingCount > 0 && showsPendingAlerts ? (
            <Bell aria-hidden className="size-4" />
          ) : (
            <BellOff aria-hidden className="size-4" />
          )}
          Ver pedidos
        </Link>
      </div>
    </div>
  );
}
