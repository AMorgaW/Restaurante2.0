import { NextResponse, type NextRequest } from "next/server";
import { reservationInputSchema } from "@/features/reservations/schema";
import {
  ReservationValidationError,
  createReservation,
} from "@/server/services/reservations";

export const dynamic = "force-dynamic";

/** Crea una reserva validada en servidor (franja, sucursal, ventana de fechas). */
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

  const parsed = reservationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Los datos de la reserva no son válidos.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  try {
    const reservation = await createReservation(parsed.data);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    console.error("[api/reservations] Error inesperado creando reserva");
    return NextResponse.json(
      { error: "No pudimos registrar tu reserva. Intenta de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
