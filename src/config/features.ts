/**
 * Interruptores de características. Centralizados para poder activar
 * o desactivar módulos completos sin tocar componentes.
 */
export const features = {
  pickup: true,
  delivery: true,
  favorites: true,
  cart: true,
  /** "demo" no realiza cobros reales; "stripe"/"mercadopago" requieren credenciales. */
  payments: "demo" as "demo" | "stripe" | "mercadopago",
  pwa: true,
  /** La analítica está desactivada por defecto; "debug" imprime en consola en desarrollo. */
  analytics: (process.env.NEXT_PUBLIC_ANALYTICS === "debug" ? "debug" : "off") as "off" | "debug",
  /** El banner de cookies solo aparece si hay analítica no esencial activa. */
  get cookieBanner(): boolean {
    return this.analytics !== "off";
  },
} as const;
