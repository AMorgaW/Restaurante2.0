"use client";

import { useEffect } from "react";
import { features } from "@/config/features";

/** Registra el service worker (solo producción y si el navegador lo soporta). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!features.pwa) return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la aplicación sigue funcionando por completo.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
