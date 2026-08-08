"use client";

import { ReceiptText, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transitionOrderStatusAction } from "@/app/admin/order-actions";
import { OrderManualPaymentPanel } from "@/components/dining-tables/order-manual-payment-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { branches } from "@/config/restaurant";
import { formatCurrency } from "@/lib/format/currency";
import { useMounted } from "@/hooks/use-mounted";
import { useAdminStore } from "@/stores/admin";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { adminRoleCan, allowedOrderStatusTransitions } from "@/lib/admin/authorization";
import { useOrdersStore } from "@/stores/orders";
import type { Order, OrderStatus } from "@/types/order";

const STATUS_FLOW: Array<{ value: OrderStatus; label: string }> = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmado" },
  { value: "preparing", label: "En preparación" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];

const STATUS_VARIANT: Record<OrderStatus, "success" | "warning" | "muted" | "error" | "lime"> = {
  pending: "warning",
  confirmed: "lime",
  preparing: "warning",
  ready: "success",
  delivered: "muted",
  cancelled: "error",
};

/** Gestión de pedidos: local=Zustand; supabase=PostgreSQL vía Server Action. */
export function OrdersAdminScreen({
  mode = "local",
  initialOrders = [],
  loadError = null,
}: {
  mode?: "local" | "supabase";
  initialOrders?: Order[];
  loadError?: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const mounted = useMounted();
  const storeOrders = useOrdersStore((state) => state.orders);
  const updateStatus = useOrdersStore((state) => state.updateStatus);
  const role = useEffectiveAdminRole(useAdminStore((state) => state.demoRole));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const orders = mode === "supabase" ? initialOrders : storeOrders;

  function applyTransition(order: Order, next: OrderStatus) {
    if (mode === "local") {
      try {
        updateStatus(order.id, next, role);
        toast({ title: "Estado actualizado", description: order.orderNumber });
      } catch (error) {
        toast({
          title: "No se pudo actualizar",
          description: error instanceof Error ? error.message : "La operación fue rechazada.",
          variant: "error",
        });
      }
      return;
    }

    setPendingId(order.id);
    startTransition(async () => {
      const result = await transitionOrderStatusAction({
        orderId: order.id,
        expectedStatus: order.status,
        nextStatus: next,
      });
      setPendingId(null);
      if (!result.ok) {
        toast({ title: "No se pudo actualizar", description: result.message, variant: "error" });
        router.refresh();
        return;
      }
      toast({ title: "Estado actualizado", description: order.orderNumber });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "supabase"
              ? "Pedidos reales de PostgreSQL. Solo se cambia el estado operativo; el pago es de solo lectura. La entrega consume inventario en la misma transacción."
              : "Pedidos de demostración realizados desde este navegador."}
          </p>
        </div>
        {mode === "supabase" ? (
          <Button size="sm" variant="secondary" type="button" aria-label="Actualizar pedidos" onClick={() => router.refresh()}>
            <RefreshCw aria-hidden className="size-4" />
            Actualizar
          </Button>
        ) : null}
      </header>

      {!mounted && mode === "local" ? (
        <div aria-busy="true" className="skeleton h-32 w-full rounded-card" />
      ) : loadError ? (
        <EmptyState title="No se pudieron cargar los pedidos" description={loadError} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Aún no hay pedidos"
          description={
            mode === "supabase"
              ? "Cuando existan pedidos reales visibles para tu rol, aparecerán aquí."
              : "Realiza un pedido de prueba desde la tienda para verlo aquí."
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => {
            const branch = branches.find((candidate) => candidate.id === order.branchId);
            const allowedStatuses = allowedOrderStatusTransitions(role, order.status);
            return (
              <li key={order.id} className="rounded-card border border-border-soft bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-bold">
                    <ReceiptText aria-hidden className="size-5 text-lime" />
                    {order.orderNumber}
                  </p>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {STATUS_FLOW.find((status) => status.value === order.status)?.label ?? order.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {new Date(order.createdAt).toLocaleString("es-CO")} · {branch?.name ?? "—"} ·{" "}
                  {order.fulfillmentType === "pickup"
                    ? "Recogida"
                    : order.fulfillmentType === "local"
                      ? "Mesa"
                      : "Domicilio"}{" "}
                  · pago {order.paymentStatus} ·{" "}
                  <span className="font-bold tabular-nums text-foreground">{formatCurrency(order.totals.total)}</span>
                </p>
                <p className="mt-1 text-[12px] text-muted">{order.customer.name} · {order.customer.phone}</p>
                <ul className="mt-2 flex flex-col gap-0.5 border-t border-border-soft pt-2 text-sm text-muted">
                  {order.items.map((item, index) => (
                    <li key={`${item.itemId}-${index}`} className="truncate">
                      {item.quantity} × {item.nameSnapshot}
                      {item.modifiers.length > 0 ? ` (${item.modifiers.map((m) => m.optionName).join(", ")})` : ""}
                    </li>
                  ))}
                </ul>
                {allowedStatuses.length > 0 ? (
                  <div className="mt-3 flex items-center gap-2">
                    <label htmlFor={`estado-${order.id}`} className="text-[13px] font-semibold">
                      Estado:
                    </label>
                    <select
                      id={`estado-${order.id}`}
                      value=""
                      disabled={isPending && pendingId === order.id}
                      onChange={(event) => {
                        const next = event.target.value as OrderStatus;
                        if (!allowedStatuses.includes(next)) return;
                        applyTransition(order, next);
                      }}
                      className="h-10 rounded-xl border border-border-soft bg-white/6 px-3 text-[13px] font-semibold text-foreground outline-none focus:border-lime/60"
                    >
                      <option value="" disabled className="bg-background-secondary">
                        Elegir transicion
                      </option>
                      {STATUS_FLOW.filter((status) => allowedStatuses.includes(status.value)).map((status) => (
                        <option key={status.value} value={status.value} className="bg-background-secondary">
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-faint">
                    No hay transiciones permitidas para tu rol y el estado actual.
                  </p>
                )}
                {mode === "supabase" && adminRoleCan(role, "confirm-manual-payments") ? (
                  <OrderManualPaymentPanel
                    orderId={order.id}
                    paymentStatus={order.paymentStatus}
                    tableSessionId={order.tableSessionId}
                    canConfirm
                    orderTotal={order.totals.total}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
