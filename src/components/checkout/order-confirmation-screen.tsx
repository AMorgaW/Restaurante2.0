"use client";

import { CheckCircle2, ChefHat, MapPin, Phone, ReceiptText } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useTransitionRouter } from "next-view-transitions";
import { CartSummary } from "@/components/cart/cart-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { branches } from "@/config/restaurant";
import { formatCurrency } from "@/lib/format/currency";
import { useMounted } from "@/hooks/use-mounted";
import { useOrdersStore } from "@/stores/orders";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo para recoger",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pago pendiente",
  processing: "Procesando pago",
  paid: "Pagado (demostración)",
  failed: "Pago fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

/**
 * Confirmación de pedido. En modo demo los pedidos viven en el
 * navegador donde se realizaron; si no se encuentra, se explica.
 */
export function OrderConfirmationScreen({ orderId }: { orderId: string }) {
  const router = useTransitionRouter();
  const mounted = useMounted();
  const reduced = useReducedMotion() ?? false;
  const order = useOrdersStore((state) => state.getById(orderId));

  if (!mounted) {
    return (
      <div aria-busy="true" className="flex flex-col items-center gap-4 px-5 pt-16">
        <div className="skeleton size-20 rounded-full" />
        <div className="skeleton h-7 w-52 rounded-xl" />
        <div className="skeleton h-40 w-full rounded-card" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-5 pt-10">
        <EmptyState
          title="Pedido no encontrado"
          description="Los pedidos de demostración se guardan en el navegador donde se realizaron. Verifica el enlace o realiza un nuevo pedido."
          action={
            <Button size="md" onClick={() => router.push("/menu")}>
              Ir al menú
            </Button>
          }
        />
      </div>
    );
  }

  const branch = branches.find((candidate) => candidate.id === order.branchId);

  return (
    <div className="flex flex-col gap-5 px-5 pb-16 pt-10">
      <div className="flex flex-col items-center text-center">
        <m.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduced ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 20 }
          }
        >
          <CheckCircle2 aria-hidden className="size-20 text-success" strokeWidth={1.6} />
        </m.div>
        <h1 className="mt-4 text-screen-title font-extrabold tracking-tight text-balance">
          ¡Pedido confirmado!
        </h1>
        <p className="mt-1 text-sm text-muted">
          Número de pedido{" "}
          <span className="font-bold tabular-nums text-foreground">{order.orderNumber}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="success">{STATUS_LABELS[order.status] ?? order.status}</Badge>
          <Badge variant="lime">{PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}</Badge>
          <Badge variant="muted">
            {order.fulfillmentType === "pickup" ? "Recogida en tienda" : "Domicilio"}
          </Badge>
        </div>
      </div>

      {branch ? (
        <section
          aria-label="Información de la sucursal"
          className="rounded-card border border-border-soft bg-surface p-4"
        >
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ChefHat aria-hidden className="size-5 text-lime" />
            {order.fulfillmentType === "pickup" ? "Recoge tu pedido en" : "Preparado por"}
          </h2>
          <p className="mt-2 font-semibold">{branch.name}</p>
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {branch.address}, {branch.city}
          </p>
          <a
            href={`tel:${branch.phone.replace(/\s/g, "")}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-lime underline-offset-4 hover:underline"
          >
            <Phone aria-hidden className="size-4" />
            {branch.phone}
          </a>
          {order.address ? (
            <p className="mt-3 border-t border-border-soft pt-3 text-sm text-muted">
              Entrega en: <span className="font-semibold text-foreground">{order.address.street}</span>
              {order.address.details ? ` · ${order.address.details}` : ""}
              {order.address.neighborhood ? ` · ${order.address.neighborhood}` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      <section
        aria-label="Detalle del pedido"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ReceiptText aria-hidden className="size-5 text-lime" />
          Tu pedido
        </h2>
        <ul className="mt-3 flex flex-col gap-2 border-b border-border-soft pb-3">
          {order.items.map((item, index) => (
            <li key={`${item.itemId}-${index}`} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">
                  {item.quantity} × {item.nameSnapshot}
                </p>
                {item.modifiers.length > 0 ? (
                  <p className="text-[12px] text-muted">
                    {item.modifiers.map((modifier) => modifier.optionName).join(", ")}
                  </p>
                ) : null}
                {item.notes ? <p className="text-[12px] italic text-faint">“{item.notes}”</p> : null}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatCurrency(item.total)}
              </span>
            </li>
          ))}
        </ul>
        <div className="pt-3">
          <CartSummary totals={order.totals} fulfillmentType={order.fulfillmentType} />
        </div>
      </section>

      <p className="rounded-2xl border border-border-soft bg-white/4 px-4 py-3 text-center text-[13px] text-muted">
        Este es un pedido de <strong className="text-foreground">demostración</strong>: no se realizó
        ningún cobro real.
      </p>

      <div className="flex flex-col gap-2">
        <Button fullWidth onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
        <Button fullWidth variant="secondary" onClick={() => router.push("/menu")}>
          Pedir algo más
        </Button>
      </div>
    </div>
  );
}
