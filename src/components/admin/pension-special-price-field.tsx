"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { filterReveal, pickVariants } from "@/components/motion/variants";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format/currency";

/**
 * Precio público (solo lectura) + revelado de agreed_price vía CTA.
 * Conserva el valor al cerrar el revelado.
 */
export function PensionSpecialPriceField({
  publicPrice,
  agreedPrice,
  onAgreedPriceChange,
  specialOpen,
  onSpecialOpenChange,
  allowSurcharge = false,
}: {
  publicPrice: number;
  agreedPrice: string;
  onAgreedPriceChange: (value: string) => void;
  specialOpen: boolean;
  onSpecialOpenChange: (open: boolean) => void;
  allowSurcharge?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const parsed = Number(agreedPrice);
  const invalid =
    agreedPrice.trim() !== "" &&
    (!Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      (!allowSurcharge && parsed > publicPrice));

  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-border-soft bg-background-secondary/40 px-3 py-3">
        <p className="text-xs font-semibold text-muted">Precio público</p>
        <p className="mt-1 text-lg font-extrabold tabular-nums">{formatCurrency(publicPrice)}</p>
        <p className="mt-1 text-xs text-muted">
          El precio especial no aplica descuento automático al menú.
        </p>
      </div>
      {!specialOpen ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onSpecialOpenChange(true)}
        >
          Aplicar precio especial
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSpecialOpenChange(false)}
        >
          Ocultar precio especial
        </Button>
      )}
      <AnimatePresence initial={false}>
        {specialOpen ? (
          <m.div
            key="special-price"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={pickVariants(reduced, filterReveal)}
          >
            <label className="text-sm font-semibold">
              Precio acordado
              <input
                type="number"
                min={0}
                step={1}
                value={agreedPrice}
                onChange={(event) => onAgreedPriceChange(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-border-soft bg-surface px-3 font-normal"
              />
            </label>
            {invalid ? (
              <p className="mt-2 text-xs text-error" role="alert">
                {!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0
                  ? "Ingresa un precio entero no negativo."
                  : "El precio acordado no puede superar el público sin confirmar recargo."}
              </p>
            ) : null}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
