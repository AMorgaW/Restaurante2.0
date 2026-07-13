import { NextResponse, type NextRequest } from "next/server";
import { checkoutInputSchema } from "@/features/checkout/schema";
import { OrderValidationError, placeOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/**
 * Crea un pedido. El cuerpo se valida con Zod y todos los importes se
 * recalculan en el servidor. En modo local el pedido validado se
 * devuelve al cliente (que lo persiste); con Supabase se guarda en BD.
 */
export async function POST(request: NextRequest) {
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
    console.error("[api/orders] Error inesperado creando pedido");
    return NextResponse.json(
      { error: "No pudimos procesar tu pedido. Intenta de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
