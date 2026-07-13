import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { verifyStripeWebhookSignature } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * Webhook de Stripe. Confirma pagos SOLO mediante eventos firmados;
 * nunca se confía en el retorno del navegador. Sin credenciales
 * configuradas responde 503 con un mensaje claro.
 */
export async function POST(request: NextRequest) {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe no está configurado en este despliegue (STRIPE_WEBHOOK_SECRET ausente)." },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Firma de webhook inválida." }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { metadata?: { order_id?: string } } };
  };

  // Estados de pago que interesan al pedido. La actualización en BD se
  // realiza solo en modo Supabase (en local no hay persistencia servidor).
  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) {
      const { getResolvedDataMode } = await import("@/lib/env/server");
      if (getResolvedDataMode() === "supabase") {
        const { getSupabaseServiceClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseServiceClient();
        await supabase
          .from("orders")
          .update({
            payment_status: event.type === "payment_intent.succeeded" ? "paid" : "failed",
          })
          .eq("id", orderId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
