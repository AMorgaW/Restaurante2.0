import type { Order } from "@/types/order";
import type { PaymentIntentResult, PaymentProvider } from "./types";

/**
 * Proveedor de pagos de DEMOSTRACIÓN: confirma el flujo completo sin
 * realizar ningún cobro real ni contactar servicios externos. El
 * checkout lo etiqueta claramente como "Pago de demostración".
 */
export class DemoPaymentProvider implements PaymentProvider {
  readonly name = "demo" as const;

  async createPaymentIntent(order: Order): Promise<PaymentIntentResult> {
    return {
      providerReference: `demo_${order.id}`,
      status: "succeeded",
    };
  }
}
