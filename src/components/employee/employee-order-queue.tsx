"use client";

import { Bike, Check, ChefHat, Clock3, MapPin, MessageSquare, RefreshCw, Store, Utensils, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { transitionOrderStatusAction } from "@/app/admin/order-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format/currency";
import { canEmployeeAction, type EmployeeRole } from "@/lib/employee/authorization";
import { filterEmployeeOrders, getEmployeeOrderViews, statusLabel } from "@/lib/employee/selectors";
import type { EmployeeOrderFilter } from "@/lib/employee/types";
import { useOrdersStore } from "@/stores/orders";
import type { OrderStatus } from "@/types/order";
import type { Order } from "@/types/order";

const FILTERS: Array<{ value: EmployeeOrderFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Nuevos" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: "delivery", label: "Domicilio" },
  { value: "local", label: "Local" },
];

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "error" | "lime"> = {
  pending: "warning",
  confirmed: "lime",
  preparing: "warning",
  ready: "success",
  delivered: "muted",
  cancelled: "error",
};

function channelIcon(channel: "Domicilio" | "Mostrador") {
  return channel === "Domicilio" ? Bike : Store;
}

function actionLabel(role: EmployeeRole, nextStatus?: string): string | null {
  if (role === "kitchen" && nextStatus === "preparing") return "Preparar";
  if (role === "kitchen" && nextStatus === "ready") return "Marcar listo";
  if (role === "cashier" && nextStatus === "confirmed") return "Confirmar";
  if (role === "cashier" && nextStatus === "delivered") return "Entregar";
  if (role === "manager" && nextStatus === "confirmed") return "Confirmar";
  if (role === "manager" && nextStatus === "preparing") return "Preparar";
  if (role === "manager" && nextStatus === "ready") return "Marcar listo";
  if (role === "manager" && nextStatus === "delivered") return "Entregar";
  if (role === "manager" && nextStatus === "cancelled") return "Cancelar";
  return null;
}

function actionCapability(role: EmployeeRole, currentStatus: OrderStatus, nextStatus?: OrderStatus) {
  if (nextStatus === "preparing" || nextStatus === "ready") return canEmployeeAction(role, "prepare-order", currentStatus, nextStatus);
  if (nextStatus === "confirmed") return canEmployeeAction(role, "confirm-order", currentStatus, nextStatus);
  if (nextStatus === "delivered") return canEmployeeAction(role, "deliver-order", currentStatus, nextStatus);
  if (nextStatus === "cancelled") return role === "manager";
  return false;
}

export function EmployeeOrderQueue({
  role,
  observedAt,
  orders: scopedOrders,
  mode = "local",
  loadError = null,
}: {
  role: EmployeeRole;
  observedAt: string;
  orders?: Order[];
  mode?: "local" | "supabase";
  loadError?: string | null;
}) {
  const router = useRouter();
  const storeOrders = useOrdersStore((state) => state.orders);
  const updateStatus = useOrdersStore((state) => state.updateStatus);
  const { toast } = useToast();
  const [filter, setFilter] = useState<EmployeeOrderFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const blockDelivered = mode === "supabase";
  const views = useMemo(() => {
    const orders = mode === "supabase" ? (scopedOrders ?? []) : (scopedOrders ?? storeOrders);
    return filterEmployeeOrders(getEmployeeOrderViews(orders, role, observedAt, { blockDelivered }), filter);
  }, [mode, scopedOrders, storeOrders, role, observedAt, filter, blockDelivered]);

  function runTransition(order: Order, nextStatus: OrderStatus, label: string) {
    if (mode === "local") {
      try {
        updateStatus(order.id, nextStatus, role);
        toast({ title: "Pedido actualizado", description: `${order.orderNumber}: ${label}`, variant: "success" });
      } catch (error) {
        toast({ title: "No se pudo actualizar", description: error instanceof Error ? error.message : "La acción fue rechazada.", variant: "error" });
      }
      return;
    }

    setPendingId(order.id);
    startTransition(async () => {
      const result = await transitionOrderStatusAction({
        orderId: order.id,
        expectedStatus: order.status,
        nextStatus,
      });
      setPendingId(null);
      if (!result.ok) {
        toast({ title: "No se pudo actualizar", description: result.message, variant: "error" });
        router.refresh();
        return;
      }
      toast({ title: "Pedido actualizado", description: `${order.orderNumber}: ${label}`, variant: "success" });
      router.refresh();
    });
  }

  return (
    <section id="pedidos" aria-labelledby="empleado-pedidos" className="scroll-mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">Operación</p>
          <h2 id="empleado-pedidos" className="mt-1 text-2xl font-extrabold tracking-tight">Cola de pedidos</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{views.length} visibles</span>
          {mode === "supabase" ? (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              aria-label="Actualizar pedidos"
              onClick={() => router.refresh()}
            >
              <RefreshCw aria-hidden className="size-4" />
              Actualizar
            </Button>
          ) : null}
        </div>
      </div>
      <div role="group" aria-label="Filtrar pedidos" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${filter === item.value ? "border-action bg-action text-action-foreground" : "border-border-soft bg-surface text-muted hover:text-foreground"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {loadError ? (
        <EmptyState title="No se pudieron cargar los pedidos" description={loadError} />
      ) : views.length === 0 ? (
        <EmptyState
          title="No hay pedidos en esta vista"
          description={
            mode === "supabase"
              ? "Cuando haya pedidos reales en PostgreSQL para tu sucursal, aparecerán aquí."
              : "Los pedidos locales aparecerán aquí cuando se registren en este navegador."
          }
        />
      ) : (
        <div className="mt-4 grid gap-3">
          {views.map(({ order, elapsedMinutes, channelLabel, nextStatus }) => {
            const ChannelIcon = channelIcon(channelLabel);
            const label = actionLabel(role, nextStatus);
            const canAct = actionCapability(role, order.status, nextStatus);
            const deliveredBlocked = mode === "supabase" && order.status === "ready" && (role === "cashier" || role === "manager");
            return (
              <article key={order.id} className="rounded-card border border-border-soft bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime/10 text-lime"><ChannelIcon aria-hidden className="size-5" /></div>
                    <div className="min-w-0">
                      <p className="font-extrabold">#{order.orderNumber}</p>
                      <p className="mt-0.5 text-sm text-muted">{channelLabel} · {elapsedMinutes} min transcurridos</p>
                      <p className="mt-0.5 text-xs text-muted">{order.customer.name} · pago {order.paymentStatus}</p>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[order.status] ?? "muted"}>{statusLabel(order.status)}</Badge>
                </div>
                <div className="mt-3 grid gap-2 border-t border-border-soft pt-3 text-sm">
                  {order.items.map((item, index) => (
                    <div key={`${item.itemId}-${index}`}>
                      <p className="flex items-start gap-2"><Utensils aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><span>{item.quantity} × {item.nameSnapshot}</span></p>
                      {item.modifiers.length > 0 ? (
                        <p className="ml-6 text-xs text-muted">{item.modifiers.map((modifier) => modifier.optionName).join(", ")}</p>
                      ) : null}
                    </div>
                  ))}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"><Clock3 aria-hidden className="size-3.5" /> {new Date(order.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}<span className="font-bold text-foreground">{formatCurrency(order.totals.total)}</span>{order.address ? <><MapPin aria-hidden className="size-3.5" /> Domicilio</> : null}{order.notes ? <><MessageSquare aria-hidden className="size-3.5" /> {order.notes}</> : null}</p>
                </div>
                {nextStatus && label && canAct ? (
                  <Button
                    size="md"
                    fullWidth
                    className="mt-4"
                    disabled={isPending && pendingId === order.id}
                    onClick={() => runTransition(order, nextStatus, label)}
                  >
                    {nextStatus === "preparing" ? <ChefHat aria-hidden className="size-5" /> : nextStatus === "delivered" ? <Check aria-hidden className="size-5" /> : <Check aria-hidden className="size-5" />}
                    {label}
                  </Button>
                ) : deliveredBlocked ? (
                  <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted"><XCircle aria-hidden className="size-4" /> Entrega pendiente de inventario (11B-4)</p>
                ) : order.status === "delivered" || order.status === "cancelled" ? (
                  <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted"><XCircle aria-hidden className="size-4" /> Estado terminal</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
