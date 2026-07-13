"use client";

import { ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { branches } from "@/config/restaurant";
import { formatCurrency } from "@/lib/format/currency";
import { useMounted } from "@/hooks/use-mounted";
import { roleCan, useAdminStore } from "@/stores/admin";
import { useOrdersStore } from "@/stores/orders";
import type { OrderStatus } from "@/types/order";

const STATUS_FLOW: Array<{ value: OrderStatus; label: string }> = [
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

/** Gestión de pedidos demo del navegador con cambio de estado real. */
export function OrdersAdminScreen() {
  const { toast } = useToast();
  const mounted = useMounted();
  const orders = useOrdersStore((state) => state.orders);
  const updateStatus = useOrdersStore((state) => state.updateStatus);
  const role = useAdminStore((state) => state.demoRole);
  const canEditOrders = roleCan(role, "edit-orders");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Pedidos</h1>
        <p className="mt-1 text-sm text-muted">
          Pedidos de demostración realizados desde este navegador. Con Supabase, aquí se listan los
          pedidos reales de todas las sucursales (con Realtime opcional).
        </p>
      </header>

      {!mounted ? (
        <div aria-busy="true" className="skeleton h-32 w-full rounded-card" />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Aún no hay pedidos"
          description="Realiza un pedido de prueba desde la tienda para verlo aquí."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => {
            const branch = branches.find((candidate) => candidate.id === order.branchId);
            return (
              <li key={order.id} className="rounded-card border border-border-soft bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-bold">
                    <ReceiptText aria-hidden className="size-5 text-lime" />
                    {order.orderNumber}
                  </p>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {STATUS_FLOW.find((status) => status.value === order.status)?.label ??
                      order.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {new Date(order.createdAt).toLocaleString("es-CO")} · {branch?.name ?? "—"} ·{" "}
                  {order.fulfillmentType === "pickup" ? "Recogida" : "Domicilio"} ·{" "}
                  <span className="font-bold tabular-nums text-foreground">
                    {formatCurrency(order.totals.total)}
                  </span>
                </p>
                <ul className="mt-2 flex flex-col gap-0.5 border-t border-border-soft pt-2 text-sm text-muted">
                  {order.items.map((item, index) => (
                    <li key={`${item.itemId}-${index}`} className="truncate">
                      {item.quantity} × {item.nameSnapshot}
                    </li>
                  ))}
                </ul>
                {canEditOrders ? (
                  <div className="mt-3 flex items-center gap-2">
                    <label htmlFor={`estado-${order.id}`} className="text-[13px] font-semibold">
                      Estado:
                    </label>
                    <select
                      id={`estado-${order.id}`}
                      value={order.status}
                      onChange={(event) => {
                        updateStatus(order.id, event.target.value as OrderStatus);
                        toast({ title: "Estado actualizado", description: order.orderNumber });
                      }}
                      className="h-10 rounded-xl border border-border-soft bg-white/6 px-3 text-[13px] font-semibold text-foreground outline-none focus:border-lime/60"
                    >
                      {STATUS_FLOW.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                          className="bg-background-secondary"
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-faint">
                    Tu rol no permite cambiar estados de pedido.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
