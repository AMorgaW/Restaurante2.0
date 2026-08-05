import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ dataMode: "supabase", secret: "whsec_test_only" }));
const database = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({ STRIPE_WEBHOOK_SECRET: envState.secret }),
  getResolvedDataMode: () => envState.dataMode,
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseServiceClient: () => ({ rpc: database.rpc }),
}));

import { POST } from "@/app/api/webhooks/stripe/route";
import { verifyStripeWebhookSignature } from "@/lib/payments/stripe";

const orderId = "123e4567-e89b-42d3-a456-426614174000";

function signedRequest(event: unknown, signatures?: string[]) {
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const valid = createHmac("sha256", envState.secret).update(`${timestamp}.${payload}`).digest("hex");
  const values = signatures ?? [valid];
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": `t=${timestamp},${values.map((value) => `v1=${value}`).join(",")}` },
    body: payload,
  }) as never;
}

function event(type = "payment_intent.succeeded", metadata: Record<string, unknown> = { order_id: orderId }) {
  return { id: "evt_test", type, data: { object: { metadata } } };
}

describe("webhook Stripe", () => {
  beforeEach(() => {
    envState.dataMode = "supabase";
    envState.secret = "whsec_test_only";
    database.rpc.mockReset();
    database.rpc.mockResolvedValue({ data: "paid", error: null });
  });

  it("acepta una firma valida entre multiples v1", () => {
    const payload = "{}";
    const timestamp = Math.floor(Date.now() / 1000);
    const valid = createHmac("sha256", envState.secret).update(`${timestamp}.${payload}`).digest("hex");
    expect(verifyStripeWebhookSignature(payload, `t=${timestamp},v1=${"0".repeat(64)},v1=${valid}`, envState.secret)).toBe(true);
  });

  it("rechaza firma invalida y secreto ausente", async () => {
    const invalid = signedRequest(event(), ["0".repeat(64)]);
    expect((await POST(invalid)).status).toBe(400);
    envState.secret = "";
    expect((await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST" }) as never)).status).toBe(503);
  });

  it("acepta eventos irrelevantes sin usar service role", async () => {
    const response = await POST(signedRequest(event("customer.created", {})));
    expect(response.status).toBe(200);
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it.each([{}, { order_id: "not-a-uuid" }])("rechaza order_id ausente o invalido %#", async (metadata) => {
    const response = await POST(signedRequest(event("payment_intent.succeeded", metadata)));
    expect(response.status).toBe(422);
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("delega escritura e idempotencia en una RPC transaccional", async () => {
    const response = await POST(signedRequest(event()));
    expect(response.status).toBe(200);
    expect(database.rpc).toHaveBeenCalledWith("process_stripe_payment_event", expect.objectContaining({
      target_event_id: "evt_test",
      target_event_type: "payment_intent.succeeded",
      target_order: orderId,
      target_payload_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
  });

  it.each([
    { data: null },
    { data: "failed" },
    { data: "processing" },
  ])("nunca responde 200 si la RPC no confirma el estado exacto %#", async ({ data }) => {
    database.rpc.mockResolvedValueOnce({ data, error: null });
    expect((await POST(signedRequest(event()))).status).toBe(500);
  });

  it("procesa un evento fallido legitimo y responde 200", async () => {
    database.rpc.mockResolvedValueOnce({ data: "failed", error: null });
    const response = await POST(signedRequest(event("payment_intent.payment_failed")));
    expect(response.status).toBe(200);
    expect(database.rpc).toHaveBeenCalledWith(
      "process_stripe_payment_event",
      expect.objectContaining({ target_event_type: "payment_intent.payment_failed" }),
    );
  });

  it("responde 500 ante error SQL y 503 si los datos remotos estan deshabilitados", async () => {
    database.rpc.mockResolvedValueOnce({ data: null, error: new Error("db") });
    expect((await POST(signedRequest(event()))).status).toBe(500);
    envState.dataMode = "local";
    expect((await POST(signedRequest(event()))).status).toBe(503);
  });
});
