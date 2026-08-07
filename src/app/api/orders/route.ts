import { NextResponse, type NextRequest } from "next/server";
import { checkoutInputSchema } from "@/features/checkout/schema";
import { getDataModeStatus } from "@/lib/env/server";
import { OrderValidationError, placeOrder } from "@/server/services/orders";
import { SupabaseApplicationWriteDisabledError } from "@/server/repositories/supabase";

export const dynamic = "force-dynamic";

/**
 * Valida y recalcula un pedido con el catálogo autoritativo.
 * - DATA_MODE=local: devuelve el pedido demo (persistencia en el navegador).
 * - DATA_MODE=supabase: valida contra Supabase y responde 503 porque la
 *   persistencia remota aún no está habilitada (11B-2).
 */
export async function POST(request: NextRequest) {
  const dataMode = getDataModeStatus();
  if (dataMode.mode === "invalid" || (dataMode.mode === "supabase" && !dataMode.configured)) {
    return NextResponse.json(
      { error: "La configuracion de datos no permite crear pedidos.", code: "data-mode-invalid" },
      { status: 503 },
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

  try {
    const order = await placeOrder(parsed.data);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    if (error instanceof SupabaseApplicationWriteDisabledError) {
      return NextResponse.json(
        {
          error:
            "El catálogo se validó correctamente, pero la persistencia remota de pedidos aún no está habilitada.",
          code: "persistence-pending",
        },
        { status: 503 },
      );
    }
    console.error("[api/orders] Error inesperado creando pedido");
    return NextResponse.json(
      { error: "No pudimos procesar tu pedido. Intenta de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
