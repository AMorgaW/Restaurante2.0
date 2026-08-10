"use client";

import Link from "next/link";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Bell, BellOff, Volume2, VolumeX, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useOperationalOrderMonitor } from "@/hooks/use-operational-order-monitor";
import { canReceivePendingOrderAlerts } from "@/lib/orders/operational-order-monitor";
import type { AdminRole } from "@/lib/admin/authorization";
import { cn } from "@/lib/utils";
import { pickVariants, scaleIn } from "@/components/motion/variants";

type OperationalOrderAlertsProps = {
  role: AdminRole | null | undefined;
  enabled: boolean;
  /** Enlace a la cola de pedidos (admin o ancla empleado). */
  ordersHref: string;
  className?: string;
  /**
   * `banner` (default): barra persistente en contenido (empleado).
   * `bell`: campana + panel en el chrome admin; cerrar ≠ atender pedido.
   */
  variant?: "banner" | "bell";
};

/**
 * Señal persistente + toggle de sonido para shells staff/admin.
 * El toast lo dispara el hook vía ToastProvider.
 * Cerrar el panel (variant=bell) no muta el estado del pedido.
 */
export function OperationalOrderAlerts({
  role,
  enabled,
  ordersHref,
  className,
  variant = "banner",
}: OperationalOrderAlertsProps) {
  const { pendingCount, soundEnabled, setSoundEnabled, lastError, active } =
    useOperationalOrderMonitor({ role, enabled });

  if (!active) return null;

  if (variant === "bell") {
    return (
      <OperationalOrderBell
        role={role}
        pendingCount={pendingCount}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        lastError={lastError}
        ordersHref={ordersHref}
        className={className}
      />
    );
  }

  return (
    <OperationalOrderBanner
      role={role}
      pendingCount={pendingCount}
      soundEnabled={soundEnabled}
      setSoundEnabled={setSoundEnabled}
      lastError={lastError}
      ordersHref={ordersHref}
      className={className}
    />
  );
}

type AlertsBodyProps = {
  role: AdminRole | null | undefined;
  pendingCount: number;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  lastError: string | null;
  ordersHref: string;
  className?: string;
};

function OperationalOrderBanner({
  role,
  pendingCount,
  soundEnabled,
  setSoundEnabled,
  lastError,
  ordersHref,
  className,
}: AlertsBodyProps) {
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
        <PendingStatusText
          showsPendingAlerts={showsPendingAlerts}
          pendingCount={pendingCount}
        />
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
          <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
        ) : null}
        <OrdersLink ordersHref={ordersHref} pendingCount={pendingCount} showsPendingAlerts={showsPendingAlerts} />
      </div>
    </div>
  );
}

function OperationalOrderBell({
  role,
  pendingCount,
  soundEnabled,
  setSoundEnabled,
  lastError,
  ordersHref,
  className,
}: AlertsBodyProps) {
  const showsPendingAlerts = canReceivePendingOrderAlerts(role);
  const reduced = useReducedMotion() ?? false;
  const panelId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
    // Restore focus to the bell; closing must not attend/mutate orders.
    queueMicrotask(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current && !rootRef.current.contains(target)) {
        closePanel();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    queueMicrotask(() => closeRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, closePanel]);

  const bellLabel =
    showsPendingAlerts && pendingCount > 0
      ? `Avisos de pedidos, ${pendingCount} pendientes`
      : "Avisos de pedidos";

  const panelVariants = pickVariants(reduced, scaleIn);

  return (
    <div
      ref={rootRef}
      data-testid="operational-order-alerts"
      className={cn("relative shrink-0", className)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={bellLabel}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-full border border-border-soft bg-white/6 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
          pendingCount > 0 && showsPendingAlerts && "border-warning/40 text-foreground",
        )}
      >
        {pendingCount > 0 && showsPendingAlerts ? (
          <Bell aria-hidden className="size-4.5" />
        ) : (
          <BellOff aria-hidden className="size-4.5" />
        )}
        {showsPendingAlerts && pendingCount > 0 ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-extrabold leading-4 text-background tabular-nums"
          >
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        ) : null}
      </button>

      {/* Always-present status for live updates + e2e (not a banner). */}
      <PendingStatusText
        showsPendingAlerts={showsPendingAlerts}
        pendingCount={pendingCount}
        className="pointer-events-none absolute h-px w-px overflow-hidden whitespace-nowrap"
      />
      <p className="pointer-events-none absolute h-px w-px overflow-hidden whitespace-nowrap">
        {lastError
          ? `Última actualización falló; se mantiene el estado conocido. ${lastError}`
          : "Avisos in-web cada ~15 s · la página debe permanecer abierta"}
      </p>

      <AnimatePresence>
        {open ? (
          <m.div
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={panelVariants}
            className={cn(
              "absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(100vw-2rem,20rem)] rounded-xl border border-border-soft bg-surface p-3 shadow-sheet",
              pendingCount > 0 && showsPendingAlerts && "border-warning/40",
            )}
            onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                closePanel();
              }
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id={titleId} className="text-sm font-extrabold text-foreground">
                Avisos de pedidos
              </h2>
              <button
                ref={closeRef}
                type="button"
                aria-label="Cerrar avisos"
                onClick={closePanel}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>

            <div className="mt-2">
              <PendingStatusText
                showsPendingAlerts={showsPendingAlerts}
                pendingCount={pendingCount}
                mirrorTestId={false}
              />
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

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {showsPendingAlerts ? (
                <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
              ) : null}
              <OrdersLink
                ordersHref={ordersHref}
                pendingCount={pendingCount}
                showsPendingAlerts={showsPendingAlerts}
                onNavigate={closePanel}
              />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PendingStatusText({
  showsPendingAlerts,
  pendingCount,
  className,
  mirrorTestId = true,
}: {
  showsPendingAlerts: boolean;
  pendingCount: number;
  className?: string;
  /** When false, omit testid (panel duplicate while closed status keeps the canonical one). */
  mirrorTestId?: boolean;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("text-sm font-bold text-foreground", className)}
      {...(mirrorTestId ? { "data-testid": "operational-pending-count" } : {})}
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
  );
}

function SoundToggle({
  soundEnabled,
  setSoundEnabled,
}: {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}) {
  return (
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
  );
}

function OrdersLink({
  ordersHref,
  pendingCount,
  showsPendingAlerts,
  onNavigate,
}: {
  ordersHref: string;
  pendingCount: number;
  showsPendingAlerts: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={ordersHref}
      onClick={onNavigate}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-3 text-xs font-bold text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
    >
      {pendingCount > 0 && showsPendingAlerts ? (
        <Bell aria-hidden className="size-4" />
      ) : (
        <BellOff aria-hidden className="size-4" />
      )}
      Ver pedidos
    </Link>
  );
}
