"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";

const CONSENT_KEY = "rb-cookie-consent";

export type CookieConsentValue = "accepted" | "rejected";

export function getStoredConsent(): CookieConsentValue | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Banner de consentimiento de cookies. Solo aparece cuando hay analítica
 * no esencial activa (features.cookieBanner); con la configuración por
 * defecto (analítica off) no se muestra y no se recopila nada.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!features.cookieBanner) return;
    setVisible(getStoredConsent() === null);
  }, []);

  if (!visible) return null;

  const decide = (value: CookieConsentValue) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // sin almacenamiento, el banner reaparecerá; preferible a rastrear sin permiso
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Preferencias de cookies"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[66] mx-auto max-w-md rounded-card border border-border-soft bg-surface-elevated p-4 shadow-sheet md:bottom-6"
    >
      <p className="text-sm text-muted">
        Usamos cookies analíticas opcionales para mejorar la experiencia. Puedes rechazarlas sin
        perder ninguna función. Más detalles en nuestra{" "}
        <Link href="/cookies" className="font-semibold text-lime underline underline-offset-2">
          política de cookies
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" fullWidth onClick={() => decide("rejected")}>
          Rechazar
        </Button>
        <Button size="sm" fullWidth onClick={() => decide("accepted")}>
          Aceptar
        </Button>
      </div>
    </div>
  );
}
