"use client";

import {
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Clock3,
  MapPin,
  Phone,
  ReceiptText,
} from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useTransitionRouter } from "next-view-transitions";
import { CartSummary } from "@/components/cart/cart-summary";
import { GuestReceiptKeyCard } from "@/components/checkout/guest-receipt-key-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { branches } from "@/config/restaurant";
import { useMounted } from "@/hooks/use-mounted";
import { formatCurrency } from "@/lib/format/currency";
import { INCLUDED_LUNCH_SOUP_GROUP_ID, NO_SOUP_OPTION_ID } from "@/lib/menu/included-soups";
import { useOrdersStore } from "@/stores/orders";
import type { Order, OrderStatus } from "@/types/order";

const STATUS_META: Record<
  OrderStatus,
  {
    title: string;
    label: string;
    description: string;
    variant: "success" | "warning" | "lime" | "error" | "muted";
  }
> = {
  pending: {
    title: "Pedido recibido",
    label: "Pendiente",
    description: "El pedido fue recibido y aún está pendiente de confirmación.",
    variant: "warning",
  },
  confirmed: {
    title: "Pedido confirmado",
    label: "Confirmado",
    description: "El pedido fue confirmado.",
    variant: "success",
  },
  preparing: {
    title: "Pedido en preparación",
    label: "En preparación",
    description: "El pedido está en preparación.",
    variant: "lime",
  },
  ready: {
    title: "Pedido listo para recoger",
    label: "Listo para recoger",
    description: "El pedido está listo para recoger.",
    variant: "success",
  },
  delivered: {
    title: "Pedido entregado",
    label: "Entregado",
    description: "El pedido figura como entregado.",
    variant: "success",
  },
  cancelled: {
    title: "Pedido cancelado",
    label: "Cancelado",
    description: "El pedido figura como cancelado.",
    variant: "error",
  },
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Pago pendiente",
  processing: "Procesando pago",
  paid: "Pagado",
  failed: "Pago fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "pending") return <Clock3 aria-hidden className="size-9" strokeWidth={1.8} />;
  if (status === "cancelled") return <CircleAlert aria-hidden className="size-9" strokeWidth={1.8} />;
  return <CheckCircle2 aria-hidden className="size-9" strokeWidth={1.8} />;
}

function formatModifier(modifier: Order["items"][number]["modifiers"][number]) {
  if (modifier.groupId === INCLUDED_LUNCH_SOUP_GROUP_ID) {
    if (
      modifier.optionId === NO_SOUP_OPTION_ID ||
      modifier.optionName.trim().toLocaleLowerCase() === "sin sopa"
    ) {
      return "Sin sopa · COP 0";
    }
    return `Sopa incluida: ${modifier.optionName} · COP 0`;
  }

  return `${modifier.groupName}: ${modifier.optionName}`;
}

function fulfillmentLabel(order: Order) {
  if (order.fulfillmentType === "pickup") return "Recogida en tienda";
  if (order.fulfillmentType === "local") return "Mesa mediante QR";
  return "Domicilio";
}

function paymentLabel(order: Order) {
  if (order.paymentMethod === "demo") return "Demostración · sin cobro real";
  return PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus;
}

/**
 * Comprobante inmediato. En DATA_MODE=local solo refleja la copia guardada
 * en rb-orders; no consulta ni confirma la existencia de una orden remota.
 */
export function OrderConfirmationScreen({
  orderId,
  guestReceiptRecoveryEnabled = false,
}: {
  orderId: string;
  guestReceiptRecoveryEnabled?: boolean;
}) {
  const router = useTransitionRouter();
  const mounted = useMounted();
  const reduced = useReducedMotion() ?? false;
  const order = useOrdersStore((state) => state.getById(orderId));

  if (!mounted) {
    return (
      <div
        aria-busy="true"
        className="order-confirmation-shell mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 pb-8 pt-8 sm:px-6"
      >
        <div className="skeleton size-16 rounded-full" />
        <div className="skeleton h-7 w-52 rounded-xl" />
        <div className="skeleton h-40 w-full rounded-card" />
      </div>
    );
  }

  if (!order) {
    return (
      <div
        data-testid="order-missing-local"
        className="order-confirmation-shell mx-auto flex w-full max-w-2xl flex-col px-4 pb-8 pt-6 sm:px-6"
      >
        <EmptyState
          title="No hay un comprobante guardado en este navegador para este enlace"
          description="Esto no confirma ni descarta que exista un pedido registrado en el servidor. Este flujo no consulta pedidos remotos."
          action={
            <div className="flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row">
              <Button size="md" fullWidth onClick={() => router.push("/menu")}>
                Volver al menú
              </Button>
              <Button size="md" fullWidth variant="secondary" onClick={() => router.push("/")}>
                Volver al inicio
              </Button>
            </div>
          }
        />
        <GuestReceiptKeyCard enabled={guestReceiptRecoveryEnabled} orderId={orderId} />
      </div>
    );
  }

  const branch = branches.find((candidate) => candidate.id === order.branchId);
  const status = STATUS_META[order.status] ?? {
    title: "Estado del pedido",
    label: order.status,
    description: "El pedido conserva el estado indicado por el sistema.",
    variant: "muted" as const,
  };

  return (
    <div
      data-testid="order-confirmation"
      className="order-confirmation-shell mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-5 sm:gap-5 sm:px-6 sm:pt-8"
    >
      <header className="flex flex-col items-center text-center">
        <m.div
          aria-hidden="true"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 20 }}
          className="flex size-16 items-center justify-center rounded-full bg-[#136A57]/10 text-[#136A57]"
        >
          <StatusIcon status={order.status} />
        </m.div>
        <h1 className="mt-3 max-w-xl text-screen-title font-extrabold tracking-tight text-balance">
          {status.title}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted">{status.description}</p>
        <p className="mt-2 max-w-full break-all text-sm text-muted">
          Referencia <span className="font-bold tabular-nums text-foreground">{order.orderNumber}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge
            variant={status.variant}
            className={`order-confirmation-status-badge status-${order.status}`}
          >
            {status.label}
          </Badge>
          <Badge variant="lime" className="order-confirmation-payment-badge">
            {paymentLabel(order)}
          </Badge>
          <Badge variant="muted">{fulfillmentLabel(order)}</Badge>
        </div>
      </header>

      <GuestReceiptKeyCard enabled={guestReceiptRecoveryEnabled} orderId={orderId} />

      {branch ? (
        <section
          aria-label="Información de la sucursal"
          className="rounded-card border border-border-soft bg-surface p-4 shadow-sm"
        >
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ChefHat aria-hidden className="size-5 text-[#136A57]" />
            {order.fulfillmentType === "pickup"
              ? "Recoge tu pedido en"
              : order.fulfillmentType === "local"
                ? "Pedido en mesa"
                : "Preparado por"}
          </h2>
          <p className="mt-2 font-semibold">{branch.name}</p>
          <p className="flex items-start gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {branch.address}, {branch.city}
          </p>
          <a
            href={`tel:${branch.phone.replace(/\s/g, "")}`}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#136A57] underline-offset-4 hover:underline"
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
        className="rounded-card border border-border-soft bg-surface p-4 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-base font-bold">
          <ReceiptText aria-hidden className="size-5 text-[#136A57]" />
          Tu pedido
        </h2>
        <ul className="mt-3 flex flex-col gap-3 border-b border-border-soft pb-3">
          {order.items.map((item, index) => (
            <li key={`${item.itemId}-${index}`} className="flex justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">
                  <span className="tabular-nums">{item.quantity} ×</span> {item.nameSnapshot}
                </p>
                {item.modifiers.length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-muted">
                    {item.modifiers.map((modifier) => (
                      <li key={`${modifier.groupId}-${modifier.optionId}`}>{formatModifier(modifier)}</li>
                    ))}
                  </ul>
                ) : null}
                {item.notes ? <p className="mt-1 text-[12px] italic text-faint">“{item.notes}”</p> : null}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(item.total)}</span>
            </li>
          ))}
        </ul>
        {order.notes ? (
          <p className="border-b border-border-soft py-3 text-sm text-muted">
            Nota del pedido: <span className="font-semibold text-foreground">{order.notes}</span>
          </p>
        ) : null}
        <div className="pt-3">
          <CartSummary totals={order.totals} fulfillmentType={order.fulfillmentType} />
        </div>
      </section>

      <p className="rounded-2xl border border-[#136A57]/20 bg-white/60 px-4 py-3 text-center text-[13px] text-muted">
        {order.paymentMethod === "demo"
          ? "Demostración · sin cobro real. Este comprobante se conserva solo en este navegador."
          : "El comprobante muestra únicamente el estado de pago registrado en el pedido."}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button fullWidth onClick={() => router.push("/menu")}>
          Pedir algo más
        </Button>
        <Button fullWidth variant="secondary" onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
