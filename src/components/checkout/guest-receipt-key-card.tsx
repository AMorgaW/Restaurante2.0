"use client";

import { Check, Clipboard, Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  acknowledgeGuestReceiptAttempt,
  listConfirmedGuestReceiptAttemptMetadata,
  removeConfirmedGuestReceiptAttempt,
  revealConfirmedGuestReceiptAttempt,
  type ConfirmedGuestReceiptIdentity,
  type GuestReceiptAttempt,
  type GuestReceiptAttemptMetadata,
} from "@/features/checkout/guest-receipt-attempt";
import { useOrdersStore } from "@/stores/orders";

type GuestReceiptKeyCardProps = {
  enabled: boolean;
  orderId?: string;
  contingencyAttempt?: GuestReceiptAttempt | null;
};

function identityOf(attempt: GuestReceiptAttempt): ConfirmedGuestReceiptIdentity {
  return {
    version: attempt.version,
    idempotencyKey: attempt.idempotencyKey,
    receiptKey: attempt.receiptKey,
    commercialFingerprint: attempt.commercialFingerprint,
    createdAt: attempt.createdAt,
    orderId: attempt.orderId,
  };
}

function metadataMatchesIdentity(
  metadata: GuestReceiptAttemptMetadata,
  identity: ConfirmedGuestReceiptIdentity,
): boolean {
  return (
    metadata.state === "confirmed" &&
    metadata.orderId === identity.orderId &&
    metadata.version === identity.version &&
    metadata.idempotencyKey === identity.idempotencyKey &&
    metadata.commercialFingerprint === identity.commercialFingerprint &&
    metadata.createdAt === identity.createdAt
  );
}

function metadataIdentity(metadata: GuestReceiptAttemptMetadata): string {
  return [
    metadata.version,
    metadata.idempotencyKey,
    metadata.commercialFingerprint,
    metadata.createdAt,
    metadata.orderId ?? "",
  ].join("|");
}

function publicLabel(metadata: GuestReceiptAttemptMetadata, orderNumbers: Map<string, string>) {
  if (metadata.orderId && orderNumbers.has(metadata.orderId)) {
    return `Pedido ${orderNumbers.get(metadata.orderId)}`;
  }
  return `Comprobante guardado · ${new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
  }).format(new Date(metadata.createdAt))}`;
}

/**
 * Local-only custody card. The server gate is passed by the dynamic page; the
 * client never decides whether durable recovery is available.
 */
export function GuestReceiptKeyCard({
  enabled,
  orderId,
  contingencyAttempt = null,
}: GuestReceiptKeyCardProps) {
  const localOrders = useOrdersStore((state) => state.orders);
  const orderNumbers = useMemo(
    () => new Map(localOrders.map((order) => [order.id, order.orderNumber])),
    [localOrders],
  );
  const [metadata, setMetadata] = useState<GuestReceiptAttemptMetadata[]>([]);
  const [loaded, setLoaded] = useState(Boolean(contingencyAttempt));
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<GuestReceiptAttempt | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const handleByIdentityRef = useRef(new Map<string, string>());
  const nextHandleRef = useRef(0);

  const handleFor = useCallback((entry: GuestReceiptAttemptMetadata): string => {
    const identity = metadataIdentity(entry);
    const existing = handleByIdentityRef.current.get(identity);
    if (existing) return existing;
    const handle = `receipt-${nextHandleRef.current}`;
    nextHandleRef.current += 1;
    handleByIdentityRef.current.set(identity, handle);
    return handle;
  }, []);

  const handleRecords = metadata.map((entry) => ({ entry, handle: handleFor(entry) }));
  const activeMetadata = handleRecords.find((record) => record.handle === selectedHandle)?.entry ?? null;

  useEffect(() => {
    if (!enabled || contingencyAttempt) return;
    try {
      const entries = listConfirmedGuestReceiptAttemptMetadata();
      setMetadata(entries);
      const selectedEntry = entries.find((entry) => entry.orderId === orderId);
      setSelectedHandle(selectedEntry ? handleFor(selectedEntry) : null);
    } catch {
      setMetadata([]);
      setSelectedHandle(null);
      setMessage("No pudimos leer la copia local de la clave en esta pestaña.");
    } finally {
      setLoaded(true);
    }
  }, [contingencyAttempt, enabled, handleFor, orderId]);

  if (!enabled || (!contingencyAttempt && (!loaded || !activeMetadata))) return null;
  const isContingency = Boolean(contingencyAttempt);
  const activeAcknowledged = Boolean(revealed?.acknowledgedAt);

  const reveal = () => {
    try {
      const attempt = contingencyAttempt
        ? contingencyAttempt
        : activeMetadata
          ? revealConfirmedGuestReceiptAttempt(activeMetadata)
          : null;
      if (!attempt) {
        setMessage("Esta copia local ya no está disponible. No generaremos otra clave.");
        return;
      }
      setRevealed(attempt);
      setCopyStatus("idle");
      setMessage(null);
    } catch {
      setMessage("No pudimos verificar esta copia local de forma segura.");
    }
  };

  const copy = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.receiptKey);
      setCopyStatus("copied");
      setMessage("Clave copiada. Guárdala fuera del navegador.");
    } catch {
      setCopyStatus("failed");
      setMessage(null);
    }
  };

  const acknowledge = () => {
    if (!revealed || isContingency) return;
    try {
      acknowledgeGuestReceiptAttempt(identityOf(revealed));
      const acknowledgedAt = new Date().toISOString();
      setRevealed({ ...revealed, acknowledgedAt, updatedAt: acknowledgedAt });
      setMetadata((entries) =>
        entries.map((entry) =>
          entry.orderId === revealed.orderId &&
          entry.idempotencyKey === revealed.idempotencyKey &&
          entry.createdAt === revealed.createdAt
            ? { ...entry, acknowledgedAt, updatedAt: acknowledgedAt }
            : entry,
        ),
      );
      setMessage("Marcada como guardada. La copia local sigue disponible hasta que la elimines.");
    } catch {
      setMessage("No pudimos guardar esta confirmación en la sesión.");
    }
  };

  const remove = () => {
    if (!revealed || isContingency) return;
    try {
      const identity = identityOf(revealed);
      removeConfirmedGuestReceiptAttempt(identity);
      setMetadata((entries) => entries.filter((entry) => !metadataMatchesIdentity(entry, identity)));
      setSelectedHandle(null);
      setRevealed(null);
      setConfirmRemoval(false);
      setMessage("La copia local se eliminó. Esto no cancela el pedido ni revoca una clave guardada fuera del navegador.");
    } catch {
      setMessage("No pudimos eliminar esta copia local.");
    }
  };

  const title = isContingency ? "Guarda tu clave de recuperación" : "Clave de recuperación";
  const description = isContingency
    ? "El servidor respondió exitosamente, pero esta pestaña no pudo conservar la credencial de forma segura. Guárdala ahora; no volveremos a enviar el pedido."
    : "Esta clave permite consultar el comprobante durante 30 días desde su emisión. Guárdala fuera del navegador.";

  return (
    <section
      aria-label="Clave de recuperación del comprobante"
      className="guest-receipt-key-card rounded-card border border-[#136A57]/30 bg-[#136A57]/[0.07] p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-[#136A57]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-[#101D39]">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>

      {activeMetadata && metadata.length > 1 ? (
        <label className="mt-4 block text-sm font-semibold text-[#101D39]">
          Comprobantes guardados en esta sesión
          <select
            aria-label="Comprobantes guardados en esta sesión"
            value={selectedHandle ?? ""}
            onChange={(event) => {
              const next = handleRecords.find((record) => record.handle === event.target.value)?.entry ?? null;
              setSelectedHandle(next ? event.target.value : null);
              setRevealed(null);
              setCopyStatus("idle");
              setConfirmRemoval(false);
              setMessage(null);
            }}
            className="mt-1 h-12 w-full rounded-button border border-border-soft bg-white/70 px-3 text-sm outline-none focus:border-[#136A57]"
          >
            {handleRecords.map(({ entry, handle }) => (
              <option key={handle} value={handle}>
                {publicLabel(entry, orderNumbers)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {revealed ? (
        <div className="mt-4 rounded-2xl border border-[#136A57]/25 bg-white/75 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#136A57]">Tu clave privada</p>
          <code className="mt-2 block break-all rounded-xl bg-[#101D39] px-3 py-3 text-sm font-semibold tracking-wide text-white">
            {revealed.receiptKey}
          </code>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="md" fullWidth onClick={() => void copy()}>
              <Clipboard aria-hidden className="size-4" />
              Copiar clave
            </Button>
            <Button
              type="button"
              size="md"
              variant="secondary"
              fullWidth
              onClick={() => setRevealed(null)}
            >
              <EyeOff aria-hidden className="size-4" />
              Ocultar
            </Button>
          </div>
          {copyStatus === "failed" ? (
            <p className="mt-2 text-xs font-semibold text-[#9F1239]" role="alert">
              La copia automática falló; selecciónala en el recuadro para copiarla manualmente.
            </p>
          ) : null}
          {!isContingency && !activeAcknowledged ? (
            <Button type="button" size="md" variant="ghost" fullWidth className="mt-2" onClick={acknowledge}>
              <Check aria-hidden className="size-4" />
              Ya guardé mi clave
            </Button>
          ) : null}
          {!isContingency ? (
            confirmRemoval ? (
              <div className="mt-3 rounded-xl border border-error/30 bg-error/10 p-3 text-sm">
                <p className="font-semibold text-[#9F1239]">
                  Se perderá esta copia local. No se cancela el pedido ni se revoca una clave guardada fuera del navegador.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="md"
                    variant="destructive"
                    fullWidth
                    className="!border-[#9F1239] !bg-[#9F1239] !text-white hover:!bg-[#881337] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[#101D39]"
                    onClick={remove}
                  >
                    <Trash2 aria-hidden className="size-4" />
                    Eliminar de este navegador
                  </Button>
                  <Button type="button" size="md" variant="secondary" fullWidth onClick={() => setConfirmRemoval(false)}>
                    Mantener copia
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                fullWidth
                className="mt-2 text-[#9F1239]"
                onClick={() => setConfirmRemoval(true)}
              >
                Eliminar clave de este navegador
              </Button>
            )
          ) : null}
        </div>
      ) : (
        <Button type="button" size="md" fullWidth className="mt-4" onClick={reveal}>
          <Eye aria-hidden className="size-4" />
          Mostrar clave
        </Button>
      )}

      {message ? (
        <p aria-live="polite" className="mt-3 text-sm font-semibold text-[#136A57]">
          {message}
        </p>
      ) : null}
      {!isContingency && metadata.length >= 8 ? (
        <p className="mt-3 text-xs text-muted">
          Esta sesión ya conserva ocho comprobantes. Para iniciar otro pedido con recuperación, elimina conscientemente una copia local.
        </p>
      ) : null}
    </section>
  );
}
