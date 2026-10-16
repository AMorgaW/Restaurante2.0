import { NextResponse, type NextRequest } from "next/server";
import { checkoutInputSchema } from "@/features/checkout/schema";
import {
  getDataModeStatus,
  isGuestReceiptRecoveryEnabled,
  isPublicOrderIntakeEnabled,
} from "@/lib/env/server";
import { OrderValidationError, placeOrder } from "@/server/services/orders";
import { OrderPersistenceError } from "@/server/orders/rpc-errors";

export const dynamic = "force-dynamic";

/**
 * Valida y crea un pedido.
 * - DATA_MODE=local: pedido demo (persistencia en el navegador).
 * - DATA_MODE=supabase: RPC comercial (o wrapper C2.2 cuando está habilitado).
 */
export async function POST(request: NextRequest) {
  const dataMode = getDataModeStatus();
  const receiptRecoveryEnabled = isGuestReceiptRecoveryEnabled();
  if (dataMode.mode === "invalid" || (dataMode.mode === "supabase" && !dataMode.configured)) {
    return NextResponse.json(
      { error: "La configuracion de datos no permite crear pedidos.", code: "data-mode-invalid" },
      { status: 503 },
    );
  }

  if (dataMode.mode === "supabase" && !isPublicOrderIntakeEnabled()) {
    return NextResponse.json(
      {
        error: "La recepción de pedidos no está disponible temporalmente.",
        code: "public-order-intake-closed",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  const parsed = checkoutInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Los datos del pedido no son válidos.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  if (dataMode.mode === "supabase" && receiptRecoveryEnabled && !parsed.data.receiptKey) {
    return NextResponse.json(
      {
        error: "La recuperación del comprobante debe prepararse antes de enviar el pedido.",
        code: "receipt-recovery-required",
      },
      { status: 503 },
    );
  }

  if (dataMode.mode === "supabase" && !receiptRecoveryEnabled && parsed.data.receiptKey) {
    return NextResponse.json(
      {
        error: "La recuperación del comprobante no está disponible en este entorno.",
        code: "receipt-recovery-unavailable",
      },
      { status: 503 },
    );
  }

  if (dataMode.mode === "local" && parsed.data.receiptKey) {
    return NextResponse.json(
      {
        error: "La recuperación durable no está disponible en el modo de demostración.",
        code: "receipt-recovery-unavailable",
      },
      { status: 422 },
    );
  }

  try {
    const order = await placeOrder(parsed.data);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    if (error instanceof OrderPersistenceError) {
      const headers =
        error.code === "public-order-intake-closed" ? { "Cache-Control": "no-store" } : undefined;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus, ...(headers ? { headers } : {}) },
      );
    }
    console.error("[api/orders] Error inesperado creando pedido");
    return NextResponse.json(
      { error: "No pudimos procesar tu pedido. Intenta de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
