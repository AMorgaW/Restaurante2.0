import { NextResponse, type NextRequest } from "next/server";
import { getResolvedDataMode, getServerEnv } from "@/lib/env/server";
import { digestStripeWebhookPayload, verifyStripeWebhookSignature } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELEVANT_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);

function privateJson(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return privateJson({ error: "Stripe no esta configurado en este despliegue." }, 503);
  }

  // La firma se valida sobre el cuerpo original, antes de parsear JSON.
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return privateJson({ error: "Firma de webhook invalida." }, 400);
  }

  let event: {
    id?: string;
    type?: string;
    data?: { object?: { metadata?: { order_id?: unknown } } };
  };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return privateJson({ error: "Payload invalido." }, 400);
  }
  if (!event.id || !event.type || !event.data?.object) {
    return privateJson({ error: "Evento invalido." }, 400);
  }

  if (!RELEVANT_EVENTS.has(event.type)) return privateJson({ received: true, ignored: true });

  const orderId = event.data.object.metadata?.order_id;
  if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) {
    return privateJson({ error: "El evento no identifica un pedido valido." }, 422);
  }

  try {
    if (getResolvedDataMode() !== "supabase") {
      return privateJson({ error: "La persistencia remota de pagos no esta habilitada." }, 503);
    }
    const { getSupabaseServiceClient } = await import("@/lib/supabase/client");
    const supabase = getSupabaseServiceClient();
    const expectedStatus = event.type === "payment_intent.succeeded" ? "paid" : "failed";
    const { data, error } = await supabase.rpc("process_stripe_payment_event", {
      target_event_id: event.id,
      target_event_type: event.type,
      target_order: orderId,
      target_payload_digest: digestStripeWebhookPayload(payload),
    });

    if (error) throw error;
    if (data !== expectedStatus) {
      return privateJson({ error: "La actualizacion del pedido no pudo verificarse." }, 500);
    }
    return privateJson({ received: true });
  } catch {
    return privateJson({ error: "No se pudo registrar el evento; Stripe puede reintentarlo." }, 500);
  }
}
