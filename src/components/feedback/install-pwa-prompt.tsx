"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { track } from "@/lib/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "rb-pwa-dismissed";
const DISMISS_DAYS = 30;

function isStandalone(): boolean {
  return (
    (window.matchMedia?.("(display-mode: standalone)")?.matches ?? false) ||
    ("standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const timestamp = Number.parseInt(raw, 10);
    return Date.now() - timestamp < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Aviso discreto de instalación PWA: solo aparece si el navegador emite
 * beforeinstallprompt, la app no está instalada y el usuario no lo
 * descartó recientemente.
 */
export function InstallPwaPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!features.pwa) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (isStandalone() || wasRecentlyDismissed()) return;
      setPromptEvent(event as BeforeInstallPromptEvent);
      // Espera breve para no interrumpir la primera interacción.
      window.setTimeout(() => setVisible(true), 12_000);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // almacenamiento no disponible: simplemente no persiste
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    setVisible(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      track("install_pwa");
    } else {
      dismiss();
    }
    setPromptEvent(null);
  };

  return (
    <AnimatePresence>
      {visible && promptEvent ? (
        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-label="Instalar aplicación"
          className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[65] mx-auto max-w-sm rounded-card border border-border-soft bg-surface-elevated p-4 shadow-sheet md:bottom-6"
        >
          <div className="flex items-start justify-between gap-3">
            <BrandMark size="sm" />
            <button
              type="button"
              aria-label="Cerrar aviso de instalación"
              onClick={dismiss}
              className="rounded-full bg-white/8 p-1.5 text-muted transition-colors hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            Instala la aplicación para pedir más rápido, incluso con conexión inestable.
          </p>
          <Button size="md" fullWidth className="mt-3" onClick={install}>
            <Download aria-hidden className="size-4" />
            Instalar aplicación
          </Button>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
