"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guestOrderReceiptSchema } from "@/features/guest-receipt/schema";
import { GuestOrderReceipt } from "@/components/checkout/guest-order-receipt";
import type { GuestOrderReceipt as GuestOrderReceiptType } from "@/types/guest-receipt";

type ScreenState = "idle" | "loading" | "unavailable" | "offline" | "invalid-response";

export function GuestReceiptRecoveryScreen({ enabled }: { enabled: boolean }) {
  const [receiptKey, setReceiptKey] = useState("");
  const [receipt, setReceipt] = useState<GuestOrderReceiptType | null>(null);
  const [state, setState] = useState<ScreenState>("idle");
  const [showKey, setShowKey] = useState(false);

  if (!enabled) {
    return (
      <div className="guest-receipt-recovery-shell mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-4 py-8">
        <section className="rounded-card border border-border-soft bg-surface p-5 text-center shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold text-[#101D39]">Recuperación temporalmente deshabilitada</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted">Esta función no está disponible en este entorno.</p>
          <Link href="/menu" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-button bg-[#FF743D] px-5 font-bold text-white">Volver al menú</Link>
        </section>
      </div>
    );
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = receiptKey.trim();
    if (!key) {
      setState("unavailable");
      return;
    }
    setState("loading");
    setReceipt(null);
    try {
      const response = await fetch("/api/order-receipt", {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiptKey: key }),
      });
      setReceiptKey("");
      setShowKey(false);
      if (response.status === 404) {
        setState("unavailable");
        return;
      }
      if (!response.ok) {
        setState("offline");
        return;
      }
      const payload: unknown = await response.json();
      const parsed = guestOrderReceiptSchema.safeParse(
        typeof payload === "object" && payload !== null && "receipt" in payload
          ? (payload as { receipt: unknown }).receipt
          : undefined,
      );
      if (!parsed.success) {
        setState("invalid-response");
        return;
      }
      setReceipt(parsed.data);
      setState("idle");
    } catch {
      setReceiptKey("");
      setShowKey(false);
      setState("offline");
    }
  };

  if (receipt) {
    return (
      <div className="guest-receipt-recovery-shell mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8 sm:py-12">
        <GuestOrderReceipt receipt={receipt} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" fullWidth onClick={() => { setReceipt(null); setState("idle"); }}>Consultar otra clave</Button>
          <Link href="/menu" className="inline-flex min-h-12 items-center justify-center rounded-button border border-border-soft bg-surface px-5 font-semibold text-foreground">Volver al menú</Link>
        </div>
      </div>
    );
  }

  const message = state === "unavailable"
    ? "No hay un comprobante disponible con esa clave."
    : state === "offline"
      ? "No pudimos consultar el comprobante en este momento. Pega la clave de nuevo para intentarlo más tarde."
      : state === "invalid-response"
        ? "Recibimos una respuesta incompleta y no mostraremos un comprobante."
        : null;

  return (
    <div className="guest-receipt-recovery-shell mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-4 py-8 sm:py-12">
      <section className="rounded-card border border-border-soft bg-surface p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <KeyRound aria-hidden className="mt-1 size-7 shrink-0 text-[#136A57]" />
          <div>
            <h1 className="text-2xl font-extrabold text-[#101D39]">Recupera tu comprobante</h1>
            <p className="mt-2 text-sm text-muted">Pega la clave privada que guardaste. Solo se enviará por una solicitud segura y no se guardará en este navegador.</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6" noValidate>
          <label htmlFor="receipt-key" className="text-sm font-bold text-[#101D39]">Clave de recuperación</label>
          <div className="mt-2 flex gap-2">
            <input
              id="receipt-key"
              name="receiptKey"
              type={showKey ? "text" : "password"}
              value={receiptKey}
              onChange={(event) => setReceiptKey(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              maxLength={43}
              disabled={state === "loading"}
              className="min-h-12 min-w-0 flex-1 rounded-button border border-border-soft bg-white/70 px-3 font-mono text-sm tracking-wide text-[#101D39] outline-none focus:border-[#136A57] focus:ring-2 focus:ring-[#136A57]/20"
            />
            <button type="button" aria-label={showKey ? "Ocultar clave" : "Mostrar clave"} onClick={() => setShowKey((value) => !value)} disabled={state === "loading"} className="min-h-12 min-w-12 rounded-button border border-border-soft bg-white/70 text-[#136A57] focus:outline-none focus:ring-2 focus:ring-[#136A57]/30">
              {showKey ? <EyeOff aria-hidden className="mx-auto size-5" /> : <Eye aria-hidden className="mx-auto size-5" />}
            </button>
          </div>
          <Button type="submit" fullWidth loading={state === "loading"} className="mt-4">
            {state === "loading" ? "Consultando…" : "Consultar comprobante"}
          </Button>
        </form>
        {state === "loading" ? <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted" aria-live="polite"><Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> Consultando de forma segura…</p> : null}
        {message ? <p className="mt-4 rounded-xl border border-[#9F1239]/20 bg-[#9F1239]/5 px-3 py-3 text-sm font-semibold text-[#9F1239]" role="alert">{message}</p> : null}
        <Link href="/menu" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#136A57] underline-offset-4 hover:underline"><ArrowLeft aria-hidden className="size-4" /> Volver al menú</Link>
      </section>
    </div>
  );
}
