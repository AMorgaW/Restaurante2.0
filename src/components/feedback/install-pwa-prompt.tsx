"use client";

import { Download, Flame, Smartphone, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { track } from "@/lib/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PwaPreviewState =
  | "visible"
  | "closed"
  | "accepted"
  | "dismissed"
  | "standalone"
  | "unsupported";

interface InstallPwaPromptProps {
  /** Exclusivo de /visual-lab: nunca dispara APIs de instalación reales. */
  previewState?: PwaPreviewState;
  onPreviewStateChange?: (state: PwaPreviewState) => void;
}

const DISMISS_KEY = "rb-pwa-dismissed";
const DISMISS_DAYS = 30;
const PROMPT_DELAY_MS = 12_000;
const EXCLUDED_PATHS = ["/admin", "/visual-lab", "/plato", "/checkout", "/pedido", "/carrito", "/offline"];

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

function canShowOnPath(pathname: string): boolean {
  return !EXCLUDED_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Superficie editorial no modal. En producción solo se muestra tras el evento
 * real `beforeinstallprompt`; el preview controlado existe solo para el lab.
 */
export function InstallPwaPrompt({ previewState, onPreviewStateChange }: InstallPwaPromptProps) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const promptingRef = useRef(false);
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const preview = previewState !== undefined;
  const routeAllowed = canShowOnPath(pathname);
  const shouldRender = preview ? previewState === "visible" : visible && promptEvent !== null && routeAllowed;

  useEffect(() => {
    if (!preview && !routeAllowed) {
      setVisible(false);
      setPromptEvent(null);
    }
  }, [preview, routeAllowed]);

  const dismiss = () => {
    setVisible(false);
    setPromptEvent(null);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sin almacenamiento el aviso no reaparece en este montaje, pero no persiste entre pestañas.
    }
  };

  useEffect(() => {
    if (preview || !features.pwa || !routeAllowed || isStandalone() || wasRecentlyDismissed()) return;

    let timer: number | undefined;
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      setPromptEvent(installEvent);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(true), PROMPT_DELAY_MS);
    };
    const onInstalled = () => {
      window.clearTimeout(timer);
      setVisible(false);
      setPromptEvent(null);
      setInstalling(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    document.documentElement.dataset.pwaInstallListener = "ready";
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      delete document.documentElement.dataset.pwaInstallListener;
    };
  }, [preview, routeAllowed]);

  useEffect(() => {
    if (!shouldRender || preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shouldRender, preview]);

  const install = async () => {
    if (preview) {
      onPreviewStateChange?.("accepted");
      return;
    }
    if (!promptEvent || installing || promptingRef.current) return;
    promptingRef.current = true;
    setInstalling(true);
    setVisible(false);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        track("install_pwa");
      } else {
        dismiss();
      }
    } finally {
      setPromptEvent(null);
      setInstalling(false);
      promptingRef.current = false;
    }
  };

  const postpone = () => {
    if (preview) {
      onPreviewStateChange?.("dismissed");
      return;
    }
    dismiss();
  };

  return (
    <AnimatePresence>
      {shouldRender ? (
        <m.aside
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          transition={{ duration: reduced ? 0.15 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          role="region"
          aria-labelledby="pwa-prompt-title"
          className="fixed inset-x-3 bottom-[calc(0.875rem+env(safe-area-inset-bottom))] z-[65] mx-auto max-w-lg rounded-card border border-border-soft bg-panel/94 p-3 shadow-sheet backdrop-blur-sm md:bottom-6"
        >
          <div className="flex items-start gap-3">
            <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-background/70 text-action">
              <Flame aria-hidden className="size-5" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="pwa-prompt-title" className="text-sm font-extrabold text-foreground">
                Pide más rápido desde tu inicio
              </h2>
              <p className="mt-0.5 text-[13px] leading-5 text-muted">
                Instala Casa Brasa para abrir el menú como una app.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso de instalación"
              onClick={postpone}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-[background-color,transform] hover:bg-white/8 hover:text-foreground active:scale-[0.94] motion-reduce:active:scale-100"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" className="min-w-0 flex-1" disabled={installing} onClick={install}>
              <Download aria-hidden className="size-4" />
              Instalar
            </Button>
            <button
              type="button"
              onClick={postpone}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-muted transition-colors hover:bg-white/8 hover:text-foreground"
            >
              <Smartphone aria-hidden className="size-4" />
              Ahora no
            </button>
          </div>
        </m.aside>
      ) : null}
    </AnimatePresence>
  );
}
