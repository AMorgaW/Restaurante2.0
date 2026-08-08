"use client";

import { formatCurrency } from "@/lib/format/currency";
import type { CartTotals, FulfillmentType } from "@/types/order";

/** Desglose de importes del carrito/checkout. */
export function CartSummary({
  totals,
  fulfillmentType,
}: {
  totals: CartTotals;
  fulfillmentType: FulfillmentType;
}) {
  const rows: Array<{ label: string; value: number; accent?: boolean }> = [
    { label: "Subtotal", value: totals.subtotal },
    ...(totals.discount > 0 ? [{ label: "Descuento", value: -totals.discount, accent: true }] : []),
    ...(totals.tax > 0 ? [{ label: "Impuestos", value: totals.tax }] : []),
    ...(totals.serviceFee > 0 ? [{ label: "Servicio", value: totals.serviceFee }] : []),
    ...(fulfillmentType === "delivery" ? [{ label: "Domicilio", value: totals.deliveryFee }] : []),
    ...(totals.tip > 0 ? [{ label: "Propina", value: totals.tip }] : []),
  ];

  return (
    <dl className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd
            className={`text-sm font-semibold tabular-nums ${row.accent ? "text-lime" : "text-foreground"}`}
          >
            {row.value < 0 ? `−${formatCurrency(Math.abs(row.value))}` : formatCurrency(row.value)}
          </dd>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border-soft pt-3">
        <dt className="text-base font-bold">Total</dt>
        <dd className="text-xl font-extrabold tabular-nums">{formatCurrency(totals.total)}</dd>
      </div>
    </dl>
  );
}
