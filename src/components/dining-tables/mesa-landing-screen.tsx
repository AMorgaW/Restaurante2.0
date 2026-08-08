"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart";
import { useTableContextStore } from "@/stores/table-context";

export function MesaLandingScreen({
  tableCode,
  tableName,
  invalid = false,
  branchConfigId,
}: {
  tableCode: string;
  tableName: string | null;
  invalid?: boolean;
  branchConfigId?: string | null;
}) {
  const setFulfillment = useCartStore((state) => state.setFulfillment);
  const setBranch = useCartStore((state) => state.setBranch);

  useEffect(() => {
    if (invalid) return;
    setFulfillment("local");
    if (branchConfigId) {
      setBranch(branchConfigId);
    }
  }, [invalid, branchConfigId, setFulfillment, setBranch]);

  if (invalid) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
          Brisas del Sinú
        </p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Código QR no válido</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Este código QR ya no es válido. Solicita ayuda al personal.
        </p>
        <Link href="/" className="mt-6">
          <Button type="button" size="md">
            Ir al inicio
          </Button>
        </Link>
      </div>
    );
  }

  const displayName = tableName?.trim();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-center">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
        Brisas del Sinú
      </p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
        Estás en Mesa {tableCode}
      </h1>
      {displayName ? (
        <p className="mt-2 text-base font-semibold text-muted">{displayName}</p>
      ) : null}
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        Tu pedido se asociará a esta mesa. Explora el menú y pide cuando quieras.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link href="/menu" className="w-full">
          <Button type="button" size="lg" fullWidth>
            Ver menú
          </Button>
        </Link>
        <Link
          href="/pensionado"
          className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Espacio pensionados
        </Link>
      </div>
    </div>
  );
}

/**
 * Enlaza el token resuelto al store de sesión (sessionStorage) y muestra el landing.
 */
export function MesaLandingBinder({
  tableQrToken,
  tableCode,
  tableName,
  branchConfigId,
}: {
  tableQrToken: string;
  tableCode: string;
  tableName: string | null;
  branchConfigId: string;
}) {
  const setFromResolved = useTableContextStore((state) => state.setFromResolved);

  useEffect(() => {
    setFromResolved({
      tableQrToken,
      tableCode,
      tableName,
      branchConfigId,
    });
  }, [tableQrToken, tableCode, tableName, branchConfigId, setFromResolved]);

  return (
    <MesaLandingScreen
      tableCode={tableCode}
      tableName={tableName}
      branchConfigId={branchConfigId}
    />
  );
}
