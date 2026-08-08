"use client";

import { ArrowLeft, Banknote, CircleCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  confirmManualTableSessionPaymentAction,
  voidManualPaymentConfirmationAction,
} from "@/app/admin/dining-table-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { createIdempotencyAttempt } from "@/lib/dining-tables/idempotency";
import { formatCurrency } from "@/lib/format/currency";
import type {
  ManualPaymentHistory,
  ManualPaymentHistoryEntry,
  ManualPaymentMethod,
  TableSessionAccount,
} from "@/types/dining-tables";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  processing: "Procesando",
  paid: "Pagado",
  failed: "Fallido",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  bank_transfer: "Transferencia",
  zero_balance: "Sin saldo",
};

function labelStatus(value: string, map: Record<string, string>): string {
  return map[value] ?? value;
}

export function TableSessionAccountScreen({
  account,
  history,
  loadError,
  canConfirm,
  canVoid,
  basePath,
}: {
  account: TableSessionAccount | null;
  history: ManualPaymentHistory;
  loadError: string | null;
  canConfirm: boolean;
  canVoid: boolean;
  basePath: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [transferReference, setTransferReference] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ManualPaymentHistoryEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [lastVoidInfo, setLastVoidInfo] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const confirmAttemptRef = useRef(createIdempotencyAttempt());
  const voidAttemptRef = useRef(createIdempotencyAttempt());

  async function confirmPayment(method: ManualPaymentMethod) {
    if (!account || isPending) return;
    setActionMessage(null);
    setIsPending(true);
    try {
      const result = await confirmManualTableSessionPaymentAction({
        sessionId: account.session.sessionId,
        method,
        reference: method === "bank_transfer" ? transferReference.trim() || null : null,
        idempotencyKey: confirmAttemptRef.current.getKey(),
      });
      if (!result.ok) {
        setActionMessage(result.message);
        toast({ title: "No se pudo confirmar el cobro", description: result.message, variant: "error" });
        return;
      }
      confirmAttemptRef.current.succeed();
      setShowTransfer(false);
      setTransferReference("");
      setActionMessage(result.data.replay ? "Cobro ya registrado" : "Cobro confirmado");
      toast({
        title: result.data.replay ? "Cobro ya registrado" : "Cobro confirmado",
        description: `${METHOD_LABEL[result.data.method as keyof typeof METHOD_LABEL] ?? result.data.method} · ${formatCurrency(result.data.amount)}`,
        variant: "success",
      });
      await router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function confirmVoid() {
    if (!voidTarget || isPending) return;
    const reason = voidReason.trim();
    if (reason.length < 3) {
      toast({ title: "Escribe un motivo", description: "Mínimo 3 caracteres.", variant: "error" });
      return;
    }
    setIsPending(true);
    try {
      const result = await voidManualPaymentConfirmationAction({
        confirmationId: voidTarget.confirmationId,
        reason,
        idempotencyKey: voidAttemptRef.current.getKey(),
      });
      if (!result.ok) {
        setActionMessage(result.message);
        toast({ title: "No se pudo anular", description: result.message, variant: "error" });
        return;
      }
      voidAttemptRef.current.succeed();
      setLastVoidInfo(
        `Anulación registrada (${result.data.voidId.slice(0, 8)}…). La sesión permanece cerrada.`,
      );
      setVoidTarget(null);
      setVoidReason("");
      toast({
        title: result.data.replay ? "Anulación ya aplicada" : "Cobro anulado",
        variant: "success",
      });
      await router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  if (loadError && !account) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <Link
          href={basePath}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" /> Volver a mesas
        </Link>
        <EmptyState title="No se pudo cargar la cuenta" description={loadError} />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <Link
          href={basePath}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" /> Volver a mesas
        </Link>
        <EmptyState title="Cuenta no encontrada" description="La sesión de mesa no está disponible." />
      </div>
    );
  }

  const { session, orders, summary } = account;
  const mesaTitle = session.tableName?.trim() || `Mesa ${session.tableCode}`;
  const sessionOpen = session.status === "open";
  const outstanding = summary.outstandingTotal;
  const canSettle =
    canConfirm &&
    sessionOpen &&
    orders.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-8">
      <header>
        <Link
          href={basePath}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-lime"
        >
          <ArrowLeft aria-hidden className="size-4" /> Volver a mesas
        </Link>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
          Cuenta de mesa
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{mesaTitle}</h1>
          <Badge variant={sessionOpen ? "warning" : "muted"}>
            {sessionOpen ? "Abierta" : "Cerrada"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted">Código {session.tableCode}</p>
      </header>

      {loadError ? (
        <p role="alert" className="rounded-card border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-warning">
          {loadError}
        </p>
      ) : null}

      {lastVoidInfo ? (
        <p
          role="status"
          className="rounded-card border border-border-soft bg-surface px-4 py-3 text-sm text-muted"
        >
          <ShieldAlert aria-hidden className="mr-1 inline size-4 text-warning" />
          {lastVoidInfo}
        </p>
      ) : null}

      <section
        aria-labelledby="resumen-cuenta"
        className="rounded-card border border-border-soft bg-surface p-5"
      >
        <h2 id="resumen-cuenta" className="text-lg font-bold">
          Resumen
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Pedidos</dt>
            <dd className="mt-1 text-xl font-extrabold">{summary.orderCount}</dd>
          </div>
          <div>
            <dt className="text-muted">Total cuenta</dt>
            <dd className="mt-1 text-xl font-extrabold">{formatCurrency(summary.accountTotal)}</dd>
          </div>
          <div>
            <dt className="text-muted">Pendiente</dt>
            <dd className="mt-1 text-xl font-extrabold">{formatCurrency(summary.outstandingTotal)}</dd>
          </div>
          <div>
            <dt className="text-muted">Pagados</dt>
            <dd className="mt-1 font-semibold">{summary.paidCount}</dd>
          </div>
          <div>
            <dt className="text-muted">Por cobrar</dt>
            <dd className="mt-1 font-semibold">{summary.pendingCount}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="pedidos-mesa">
        <h2 id="pedidos-mesa" className="text-lg font-bold">
          Pedidos
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Esta sesión aún no tiene pedidos.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {orders.map((order) => (
              <li
                key={order.orderId}
                className="rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold">#{order.orderNumber}</p>
                    <p className="mt-1 text-sm text-muted">
                      Estado: {labelStatus(order.status, ORDER_STATUS_LABEL)}
                    </p>
                    <p className="text-sm text-muted">
                      Pago: {labelStatus(order.paymentStatus, PAYMENT_STATUS_LABEL)}
                    </p>
                  </div>
                  <p className="text-lg font-extrabold">{formatCurrency(order.total)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canSettle ? (
        <section
          aria-labelledby="cobro-mesa"
          className="rounded-card border border-border-soft bg-surface p-5"
        >
          <h2 id="cobro-mesa" className="flex items-center gap-2 text-lg font-bold">
            <Banknote aria-hidden className="size-5 text-lime" /> Cobrar cuenta
          </h2>
          {actionMessage ? (
            <p role="status" data-testid="payment-action-status" className="mt-3 text-sm font-semibold">
              {actionMessage}
            </p>
          ) : null}

          {outstanding === 0 ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-success">
                <CircleCheck aria-hidden className="size-4" />
                Sin saldo pendiente
              </p>
              <Button
                type="button"
                size="md"
                loading={isPending}
                disabled={isPending}
                onClick={() => confirmPayment("zero_balance")}
              >
                Confirmar sin saldo
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-muted">
                Pendiente por cobrar:{" "}
                <span className="font-extrabold text-foreground">
                  {formatCurrency(outstanding)}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="md"
                  loading={isPending}
                  disabled={isPending}
                  onClick={() => {
                    void confirmPayment("cash");
                  }}
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
                <div className="flex flex-col gap-3 rounded-button border border-border-soft bg-white/4 p-4">
                  <TextField
                    label="Referencia (opcional)"
                    name="transferReference"
                    value={transferReference}
                    onChange={(event) => setTransferReference(event.target.value)}
                    maxLength={120}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    size="md"
                    loading={isPending}
                    disabled={isPending}
                    onClick={() => confirmPayment("bank_transfer")}
                  >
                    Confirmar transferencia
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section aria-labelledby="historial-cobros">
        <h2 id="historial-cobros" className="text-lg font-bold">
          Historial de cobros
        </h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sin cobros manuales registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {history.map((entry) => (
              <li
                key={entry.confirmationId}
                className="rounded-card border border-border-soft bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {METHOD_LABEL[entry.confirmationKind] ?? entry.confirmationKind} ·{" "}
                      {formatCurrency(entry.amount)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {entry.confirmedByName ?? "Personal"} ·{" "}
                      {new Date(entry.confirmedAt).toLocaleString("es-CO")}
                    </p>
                    {entry.paymentReference ? (
                      <p className="text-sm text-muted">Ref: {entry.paymentReference}</p>
                    ) : null}
                    {entry.void ? (
                      <p className="mt-2 text-sm text-warning">
                        Anulado: {entry.void.reason} (
                        {new Date(entry.void.voidedAt).toLocaleString("es-CO")})
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={entry.status === "active" ? "success" : "muted"}>
                    {entry.status === "active" ? "Activo" : "Anulado"}
                  </Badge>
                </div>
                {canVoid && entry.status === "active" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    disabled={isPending}
                    onClick={() => {
                      voidAttemptRef.current = createIdempotencyAttempt();
                      setVoidTarget(entry);
                      setVoidReason("");
                    }}
                  >
                    Anular cobro
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVoidTarget(null);
            setVoidReason("");
          }
        }}
        title="Anular cobro"
        description="La anulación queda registrada. La sesión de mesa no se reabre automáticamente."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setVoidTarget(null);
                setVoidReason("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              loading={isPending}
              onClick={confirmVoid}
            >
              Confirmar anulación
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Motivo"
          name="voidReason"
          value={voidReason}
          onChange={(event) => setVoidReason(event.target.value)}
          required
          minLength={3}
          maxLength={300}
          rows={3}
        />
      </Dialog>
    </div>
  );
}
