import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import type { Order } from "@/types/order";
import { PaymentConfigurationError, type PaymentIntentResult, type PaymentProvider } from "./types";

/**
 * Adaptador de Stripe preparado para producción, implementado sobre la
 * API HTTP oficial (sin SDK adicional hasta que se active el proveedor).
 * Requiere STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  private getSecretKey(): string {
    const env = getServerEnv();
    const missing: string[] = [];
    if (!env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
    if (!env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
    if (missing.length > 0) throw new PaymentConfigurationError("stripe", missing);
    return env.STRIPE_SECRET_KEY as string;
  }

  async createPaymentIntent(order: Order): Promise<PaymentIntentResult> {
    const secretKey = this.getSecretKey();
    const body = new URLSearchParams({
      // Stripe espera unidades menores; COP no tiene decimales.
      amount: String(order.totals.total),
      currency: order.currency.toLowerCase(),
      "metadata[order_id]": order.id,
      "metadata[order_number]": order.orderNumber,
      "automatic_payment_methods[enabled]": "true",
    });

    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": order.id,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Stripe respondió ${response.status} al crear el intento de pago.`);
    }
    const intent = (await response.json()) as { id: string; status: string };
    return {
      providerReference: intent.id,
      status: intent.status === "succeeded" ? "succeeded" : "requires_action",
    };
  }
}

/**
 * Verificación de firma de webhook de Stripe (cabecera Stripe-Signature,
 * esquema t=<ts>,v1=<hmac sha256 de "<ts>.<payload>">).
 */
export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSeconds = 300,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader) return false;
  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim() ?? "", rest.join("=")] as const;
    }),
  );
  const timestamp = Number.parseInt(parts.get("t") ?? "", 10);
  const signature = parts.get("v1");
  if (!Number.isFinite(timestamp) || !signature) return false;
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || receivedBuffer.length === 0) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
