"use client";

import { ReceiptText } from "lucide-react";
import type { GuestOrderReceipt } from "@/types/guest-receipt";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "COP" ? 0 : 2,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("es-CO")}`;
  }
}

function fulfillmentLabel(value: string) {
  return { pickup: "Recoger en sucursal", delivery: "Domicilio", local: "Mesa" }[value] ?? `Modalidad: ${value}`;
}

function statusLabel(value: string) {
  return {
    pending: "Pedido recibido",
    confirmed: "Pedido confirmado",
    preparing: "En preparación",
    ready: "Listo",
    delivered: "Entregado",
    cancelled: "Cancelado",
  }[value] ?? `Estado: ${value}`;
}

function paymentLabel(receipt: GuestOrderReceipt) {
  if (receipt.paymentMethod === "demo") return "Demostración · sin cobro real";
  const method = { cash: "Efectivo", bank_transfer: "Transferencia", zero_balance: "Saldo cero" }[
    receipt.paymentMethod
  ] ?? receipt.paymentMethod;
  return `${method} · ${receipt.paymentStatus}`;
}

export function GuestOrderReceipt({ receipt }: { receipt: GuestOrderReceipt }) {
  const rows = [
    ["Subtotal", receipt.subtotal],
    ["Descuento", receipt.discount],
    ["Impuestos", receipt.tax],
    ["Servicio", receipt.serviceFee],
    ["Domicilio", receipt.deliveryFee],
    ["Propina", receipt.tip],
  ] as const;

  return (
    <article className="w-full rounded-card border border-border-soft bg-surface p-4 shadow-sm sm:p-6">
      <header className="border-b border-border-soft pb-4">
        <div className="flex items-center gap-2 text-[#136A57]">
          <ReceiptText aria-hidden className="size-5" />
          <span className="text-sm font-bold uppercase tracking-wide">Comprobante recuperado</span>
        </div>
        <h1 className="mt-2 break-words text-2xl font-extrabold text-[#101D39]">Tu pedido</h1>
        <p className="mt-1 break-all text-sm text-muted">
          Referencia <span className="font-bold text-foreground">{receipt.orderNumber}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[#D9F65A] px-3 py-1 font-bold text-[#101D39]">{statusLabel(receipt.status)}</span>
          <span className="rounded-full bg-[#136A57]/10 px-3 py-1 font-semibold text-[#136A57]">
            {fulfillmentLabel(receipt.fulfillmentType)}
          </span>
        </div>
        {receipt.branchName ? <p className="mt-3 text-sm text-muted">Sucursal: <strong className="text-foreground">{receipt.branchName}</strong></p> : null}
        <p className="mt-2 text-sm text-muted">Pago: <strong className="text-foreground">{paymentLabel(receipt)}</strong></p>
      </header>

      <section aria-label="Detalle del comprobante" className="py-4">
        <h2 className="text-base font-bold text-[#101D39]">Detalle</h2>
        <ul className="mt-3 flex flex-col gap-4">
          {receipt.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex min-w-0 justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="break-words font-semibold"><span className="tabular-nums">{item.quantity} ×</span> {item.name}</p>
                {item.modifiers.length ? (
                  <ul className="mt-1 flex flex-col gap-1 text-xs text-muted">
                    {item.modifiers.map((modifier, modifierIndex) => (
                      <li key={`${modifier.groupName}-${modifier.optionName}-${modifierIndex}`} className="break-words">
                        {modifier.groupName}: {modifier.optionName} · {money(modifier.price, receipt.currency)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(item.total, receipt.currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      <dl className="border-t border-border-soft pt-3 text-sm">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-3 py-1 text-muted">
            <dt>{label}</dt><dd className="tabular-nums">{money(amount, receipt.currency)}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-3 border-t border-border-soft pt-3 text-lg font-extrabold text-[#101D39]">
          <dt>Total</dt><dd className="tabular-nums">{money(receipt.total, receipt.currency)}</dd>
        </div>
      </dl>
    </article>
  );
}
