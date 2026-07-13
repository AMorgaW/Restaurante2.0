import { branches, restaurantConfig } from "@/config/restaurant";
import type { ReservationInput } from "@/features/reservations/schema";
import {
  getAvailableTimeSlots,
  isDateWithinBookingWindow,
} from "@/lib/menu/opening-hours";
import { normalizePhone } from "@/lib/utils";
import { getReservationRepository } from "@/server/repositories";
import type { Reservation } from "@/types/order";

export class ReservationValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ReservationValidationError";
  }
}

/** Crea una reserva validando sucursal, ventana de fechas y franja horaria. */
export async function createReservation(input: ReservationInput): Promise<Reservation> {
  const branch = branches.find(
    (candidate) => candidate.id === input.branchId && candidate.status === "active",
  );
  if (!branch) {
    throw new ReservationValidationError("La sucursal seleccionada no está disponible.", "branch");
  }
  if (!branch.reservationsEnabled) {
    throw new ReservationValidationError(
      `${branch.name} no recibe reservas en línea por el momento.`,
      "reservations-disabled",
    );
  }

  const { maxAdvanceDays, slotIntervalMinutes, minLeadMinutes } = restaurantConfig.reservations;

  if (!isDateWithinBookingWindow(input.date, maxAdvanceDays, branch.timezone)) {
    throw new ReservationValidationError(
      `Selecciona una fecha entre hoy y los próximos ${maxAdvanceDays} días.`,
      "date-out-of-window",
    );
  }

  const slots = getAvailableTimeSlots(branch, input.date, {
    intervalMinutes: slotIntervalMinutes,
    minLeadMinutes,
  });
  if (slots.length === 0) {
    throw new ReservationValidationError(
      "La sucursal no tiene horarios disponibles para esa fecha.",
      "closed",
    );
  }
  if (!slots.includes(input.time)) {
    throw new ReservationValidationError(
      "La hora seleccionada no está disponible; elige otra franja.",
      "slot-unavailable",
    );
  }

  const reservation: Reservation = {
    id: crypto.randomUUID(),
    branchId: branch.id,
    customerName: input.customerName,
    phone: normalizePhone(input.phone),
    email: input.email,
    date: input.date,
    time: input.time,
    partySize: input.partySize,
    ...(input.occasion ? { occasion: input.occasion } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  return getReservationRepository().saveReservation(reservation);
}
