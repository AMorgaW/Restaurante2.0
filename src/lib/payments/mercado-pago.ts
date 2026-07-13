import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import { siteUrl } from "@/lib/env/client";
import type { Order } from "@/types/order";
import { PaymentConfigurationError, type PaymentIntentResult, type PaymentProvider } from "./types";

/**
 * Adaptador de Mercado Pago (Checkout Pro) preparado para producción,
 * sobre la API HTTP oficial. Requiere MERCADOPAGO_ACCESS_TOKEN.
 */
export class MercadoPagoPaymentProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;

  private getAccessToken(): string {
    const env = getServerEnv();
    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new PaymentConfigurationError("mercadopago", ["MERCADOPAGO_ACCESS_TOKEN"]);
    }
    return env.MERCADOPAGO_ACCESS_TOKEN;
  }

  async createPaymentIntent(order: Order): Promise<PaymentIntentResult> {
    const accessToken = this.getAccessToken();
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify({
        external_reference: order.id,
        items: order.items.map((item) => ({
          title: item.nameSnapshot,
          quantity: item.quantity,
          currency_id: order.currency,
          unit_price: item.unitPrice,
        })),
        back_urls: {
          success: `${siteUrl}/pedido/${order.id}`,
          pending: `${siteUrl}/pedido/${order.id}`,
          failure: `${siteUrl}/checkout?pago=fallido`,
        },
        notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago respondió ${response.status} al crear la preferencia.`);
    }
    const preference = (await response.json()) as { id: string; init_point?: string };
    return {
      providerReference: preference.id,
      ...(preference.init_point ? { redirectUrl: preference.init_point } : {}),
      status: "requires_action",
    };
  }
}

/**
 * Verificación de la cabecera x-signature de Mercado Pago
 * (manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;").
 */
export function verifyMercadoPagoWebhookSignature(options: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string;
  webhookSecret: string;
}): boolean {
  const { signatureHeader, requestIdHeader, dataId, webhookSecret } = options;
  if (!signatureHeader || !requestIdHeader) return false;

  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim() ?? "", rest.join("=").trim()] as const;
    }),
  );
  const timestamp = parts.get("ts");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;

  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${timestamp};`;
  const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
