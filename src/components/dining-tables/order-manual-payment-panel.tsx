"use client";

import { Banknote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { confirmManualOrderPaymentAction } from "@/app/admin/dining-table-actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { createIdempotencyAttempt } from "@/lib/dining-tables/idempotency";
import { formatCurrency } from "@/lib/format/currency";
import type { ManualPaymentMethod } from "@/types/dining-tables";

/**
 * Panel de cobro manual para pedidos que no pertenecen a una sesión de mesa.
 */
export function OrderManualPaymentPanel({
  orderId,
  paymentStatus,
  tableSessionId,
  canConfirm,
  orderTotal,
}: {
  orderId: string;
  paymentStatus: string;
  tableSessionId?: string | null;
  canConfirm: boolean;
  /** Solo informativo; el servidor calcula el importe. */
  orderTotal?: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showTransfer, setShowTransfer] = useState(false);
  const [reference, setReference] = useState("");
  const attemptRef = useRef(createIdempotencyAttempt());

  if (!canConfirm) return null;

  if (tableSessionId) {
    return (
      <section
        aria-labelledby="cobro-pedido-mesa"
        className="rounded-card border border-border-soft bg-surface p-4"
      >
        <h2 id="cobro-pedido-mesa" className="text-base font-bold">
          Cobro manual
        </h2>
        <p className="mt-2 text-sm text-muted">
          Este pedido pertenece a una mesa. Cobra la cuenta completa desde la sesión de la mesa.
        </p>
      </section>
    );
  }

  if (paymentStatus !== "pending") {
    return null;
  }

  function confirm(method: ManualPaymentMethod) {
    startTransition(async () => {
      const result = await confirmManualOrderPaymentAction({
        orderId,
        method,
        reference: method === "bank_transfer" ? reference.trim() || null : null,
        idempotencyKey: attemptRef.current.getKey(),
      });
      if (!result.ok) {
        toast({ title: "No se pudo confirmar el cobro", description: result.message, variant: "error" });
        return;
      }
      attemptRef.current.succeed();
      setShowTransfer(false);
      setReference("");
      toast({
        title: result.data.replay ? "Cobro ya registrado" : "Cobro confirmado",
        description:
          typeof orderTotal === "number"
            ? formatCurrency(result.data.amount)
            : undefined,
        variant: "success",
      });
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="cobro-pedido-individual"
      className="rounded-card border border-border-soft bg-surface p-4"
    >
      <h2 id="cobro-pedido-individual" className="flex items-center gap-2 text-base font-bold">
        <Banknote aria-hidden className="size-4 text-lime" /> Cobro manual
      </h2>
      <p className="mt-2 text-sm text-muted">Confirma el pago presencial de este pedido.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="md"
          loading={isPending}
          disabled={isPending}
          onClick={() => confirm("cash")}
        >
          Efectivo
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={isPending}
          onClick={() => setShowTransfer((value) => !value)}
        >
          Transferencia
        </Button>
      </div>
      {showTransfer ? (
        <div className="mt-3 flex flex-col gap-3 rounded-button border border-border-soft bg-white/4 p-3">
          <TextField
            label="Referencia (opcional)"
            name="orderTransferReference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={120}
            autoComplete="off"
          />
          <Button
            type="button"
            size="md"
            loading={isPending}
            disabled={isPending}
            onClick={() => confirm("bank_transfer")}
          >
            Confirmar transferencia
          </Button>
        </div>
      ) : null}
    </section>
  );
}
