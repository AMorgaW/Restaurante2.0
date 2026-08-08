"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR local en navegador. No envía el token a terceros.
 */
export function TableQrCode({
  value,
  label,
  size = 220,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return <p className="text-sm text-error">No se pudo generar el código QR.</p>;
  }
  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-md bg-surface"
        style={{ width: size, height: size }}
        aria-busy="true"
      >
        <span className="text-sm text-muted">Generando QR…</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL generado localmente
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={label}
      className="rounded-md bg-white p-2"
    />
  );
}

export function buildTableQrUrl(rawToken: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/mesa/${encodeURIComponent(rawToken)}`;
}
