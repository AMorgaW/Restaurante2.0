import "server-only";
import { getResolvedPaymentProvider } from "@/lib/env/server";
import { DemoPaymentProvider } from "./demo";
import { MercadoPagoPaymentProvider } from "./mercado-pago";
import { StripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/** Proveedor de pagos activo (con degradación a demo sin credenciales). */
export function getPaymentProvider(): PaymentProvider {
  switch (getResolvedPaymentProvider()) {
    case "stripe":
      return new StripePaymentProvider();
    case "mercadopago":
      return new MercadoPagoPaymentProvider();
    default:
      return new DemoPaymentProvider();
  }
}
