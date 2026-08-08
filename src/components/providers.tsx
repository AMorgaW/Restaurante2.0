"use client";

import type { ReactNode } from "react";
import { MotionProvider } from "@/components/motion/motion-provider";
import { CookieConsent } from "@/components/feedback/cookie-consent";
import { ServiceWorkerRegistrar } from "@/components/feedback/service-worker-registrar";
import { ToastProvider } from "@/components/ui/toast";

/** Proveedores globales de cliente (animación, toasts, SW de caché web, consentimiento). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <ToastProvider>
        {children}
        <ServiceWorkerRegistrar />
        <CookieConsent />
      </ToastProvider>
    </MotionProvider>
  );
}
