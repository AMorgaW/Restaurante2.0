"use client";

import { useEffect } from "react";
import { features } from "@/config/features";

const DEV_CLEANUP_KEY = "rb-dev-sw-cleaned-v1";

/**
 * Desarrollo nunca debe quedar controlado por un worker de una compilación
 * anterior. La rama solo elimina registros/cachés propios de esta app; no
 * toca el registro PWA de producción.
 */
async function cleanupDevelopmentWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const appRegistrations = registrations.filter((registration) => {
    try {
      return new URL(registration.scope).origin === window.location.origin;
    } catch {
      return false;
    }
  });
  const hadController = Boolean(navigator.serviceWorker.controller);

  await Promise.all(appRegistrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => /^(?:shell|runtime)-/.test(name))
        .map((name) => caches.delete(name)),
    );
  }

  // El controlador vigente no abandona la pestaña hasta la próxima carga.
  // Recargamos una sola vez por sesión para no dejar una navegación servida
  // por el bundle antiguo ni crear un bucle de recargas.
  if (hadController) {
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(DEV_CLEANUP_KEY) === "1";
      if (!alreadyReloaded) sessionStorage.setItem(DEV_CLEANUP_KEY, "1");
    } catch {
      // Sin sessionStorage, la limpieza sigue siendo válida sin recargar.
      alreadyReloaded = true;
    }
    if (!alreadyReloaded) window.location.reload();
  }
}

/** Registra el service worker (solo producción y si el navegador lo soporta). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!features.pwa) return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void cleanupDevelopmentWorker().catch(() => {
        // La limpieza de desarrollo es no bloqueante; la app sigue funcionando.
      });
      return;
    }

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
