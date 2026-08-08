"use client";

import { Printer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TableQrCode } from "@/components/dining-tables/table-qr-code";

const PRINT_STYLE_ID = "printable-table-qr-style";

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .printable-table-qr,
  .printable-table-qr * { visibility: visible !important; }
  .printable-table-qr {
    position: absolute;
    left: 50%;
    top: 2rem;
    transform: translateX(-50%);
    border: none !important;
    box-shadow: none !important;
  }
  .printable-table-qr-actions { display: none !important; }
}
`;

/**
 * Bloque imprimible de QR de mesa. Nunca muestra el token en texto.
 */
export function PrintableTableQr({
  tableCode,
  tableName,
  qrUrl,
}: {
  tableCode: string;
  tableName?: string | null;
  qrUrl: string;
}) {
  const mesaLabel = tableName?.trim()
    ? `${tableName.trim()} · Mesa ${tableCode}`
    : `Mesa ${tableCode}`;

  useEffect(() => {
    if (document.getElementById(PRINT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="printable-table-qr mx-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-card border border-border-soft bg-white p-6 text-center text-neutral-900">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-neutral-900">
          BRISAS DEL SINÚ
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight">{mesaLabel}</h2>
        <TableQrCode value={qrUrl} label={`Código QR de ${mesaLabel}`} size={220} />
        <p className="text-sm font-semibold text-neutral-600">Escanea para hacer tu pedido</p>
      </div>

      <div className="printable-table-qr-actions">
        <Button type="button" variant="secondary" size="md" onClick={() => window.print()}>
          <Printer aria-hidden className="size-4" />
          Imprimir
        </Button>
      </div>
    </div>
  );
}
