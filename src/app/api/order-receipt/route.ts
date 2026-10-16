import { NextResponse, type NextRequest } from "next/server";
import { guestReceiptRequestSchema } from "@/features/guest-receipt/schema";
import { isGuestReceiptRecoveryEnabled } from "@/lib/env/server";
import { readGuestOrderReceipt } from "@/server/guest-receipts/read";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, noarchive",
};

class BodyTooLargeError extends Error {}

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: SECURITY_HEADERS });
}

function unavailable() {
  return json(
    {
      error: "La recuperación de comprobantes no está disponible temporalmente.",
      code: "receipt-recovery-unavailable",
    },
    503,
  );
}

function notAvailable() {
  return json(
    { error: "No hay un comprobante disponible con esa clave.", code: "receipt-unavailable" },
    404,
  );
}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_BODY_BYTES) {
    throw new BodyTooLargeError();
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function POST(request: NextRequest) {
  if (!isGuestReceiptRecoveryEnabled()) return unavailable();

  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return json({ error: "Solicitud inválida." }, 400);
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json({ error: "Solicitud demasiado grande." }, 413);
    return json({ error: "Solicitud inválida." }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }

  const parsed = guestReceiptRequestSchema.safeParse(body);
  if (!parsed.success) return notAvailable();

  try {
    const receipt = await readGuestOrderReceipt(parsed.data.receiptKey);
    if (!receipt) return notAvailable();
    return json({ receipt }, 200);
  } catch {
    return unavailable();
  }
}
