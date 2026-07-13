import type { Order } from "@/types/order";

/**
 * Abstracción de proveedor de pagos. El proveedor activo se resuelve en
 * servidor según PAYMENT_PROVIDER y credenciales disponibles; sin
 * credenciales siempre opera el proveedor demo (sin cobros reales).
 */

export interface PaymentIntentResult {
  /** Identificador del intento en el proveedor. */
  providerReference: string;
  /** URL de redirección de pago, si el proveedor la usa. */
  redirectUrl?: string;
  /** Estado inicial reportado por el proveedor. */
  status: "requires_action" | "processing" | "succeeded";
}

export interface PaymentProvider {
  readonly name: "demo" | "stripe" | "mercadopago";
  /** Crea el intento de cobro por el TOTAL calculado en servidor. */
  createPaymentIntent(order: Order): Promise<PaymentIntentResult>;
}

export class PaymentConfigurationError extends Error {
  constructor(provider: string, missing: string[]) {
    super(
      `El proveedor de pagos "${provider}" no está configurado; faltan: ${missing.join(", ")}. ` +
        "La aplicación sigue funcionando con el proveedor demo.",
    );
    this.name = "PaymentConfigurationError";
  }
}
