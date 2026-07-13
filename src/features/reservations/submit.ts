import type { ReservationInput } from "@/features/reservations/schema";
import type { Reservation } from "@/types/order";

export type SubmitReservationResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; error: string; code?: string };

/** Envía la reserva al servidor (validación de franja y sucursal). */
export async function submitReservationRequest(
  input: ReservationInput,
): Promise<SubmitReservationResult> {
  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as {
      reservation?: Reservation;
      error?: string;
      code?: string;
    };

    if (!response.ok || !payload.reservation) {
      return {
        ok: false,
        error: payload.error ?? "No pudimos registrar tu reserva. Intenta de nuevo.",
        ...(payload.code ? { code: payload.code } : {}),
      };
    }
    return { ok: true, reservation: payload.reservation };
  } catch {
    return {
      ok: false,
      error: "Sin conexión con el servidor. Revisa tu red e intenta de nuevo.",
      code: "network",
    };
  }
}
