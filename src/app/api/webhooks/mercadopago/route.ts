import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { verifyMercadoPagoWebhookSignature } from "@/lib/payments/mercado-pago";

export const dynamic = "force-dynamic";

/**
 * Webhook de Mercado Pago con verificación de firma x-signature.
 * Sin credenciales configuradas responde 503 con un mensaje claro.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error:
          "Mercado Pago no está configurado en este despliegue (MERCADOPAGO_WEBHOOK_SECRET ausente).",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? "";

  const valid = verifyMercadoPagoWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestIdHeader: request.headers.get("x-request-id"),
    dataId,
    webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET,
  });
  if (!valid) {
    return NextResponse.json({ error: "Firma de webhook inválida." }, { status: 400 });
  }

  // La consulta del estado real del pago y la actualización del pedido se
  // realiza contra la API de MP usando external_reference en modo Supabase.
  return NextResponse.json({ received: true });
}
