"use client";

import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion/motion-provider";
import { CookieConsent } from "@/components/feedback/cookie-consent";
import { InstallPwaPrompt } from "@/components/feedback/install-pwa-prompt";
import { ServiceWorkerRegistrar } from "@/components/feedback/service-worker-registrar";
import { ToastProvider } from "@/components/ui/toast";

/** Proveedores globales de cliente (animación, toasts, PWA, consentimiento). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <ToastProvider>
        {children}
        <ServiceWorkerRegistrar />
        <InstallPwaPrompt />
        <CookieConsent />
      </ToastProvider>
    </MotionProvider>
  );
}
