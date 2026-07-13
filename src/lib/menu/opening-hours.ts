import type { Branch, OpeningStatus } from "@/types/restaurant";

/** Convierte "HH:mm" a minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export interface LocalDateParts {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  minutes: number;
  isoDate: string;
}

const WEEKDAY_MAP: Record<string, LocalDateParts["dayOfWeek"]> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Extrae día/hora/fecha locales de un instante en la zona horaria dada. */
export function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const hour = Number.parseInt(parts.hour ?? "0", 10) % 24;
  const minute = Number.parseInt(parts.minute ?? "0", 10);
  return {
    dayOfWeek: WEEKDAY_MAP[parts.weekday ?? "Sun"] ?? 0,
    minutes: hour * 60 + minute,
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Estado abierto/cerrado de una sucursal en un instante dado. */
export function getOpeningStatus(branch: Branch, now: Date = new Date()): OpeningStatus {
  const local = getLocalDateParts(now, branch.timezone);

  const special = branch.specialHours.find((entry) => entry.date === local.isoDate);
  if (special) {
    if (special.isClosed || !special.openingTime || !special.closingTime) {
      return { open: false, reason: "special" };
    }
    const opens = timeToMinutes(special.openingTime);
    const closes = timeToMinutes(special.closingTime);
    if (local.minutes < opens) {
      return { open: false, reason: "before-opening", opensAt: special.openingTime };
    }
    if (local.minutes >= closes) {
      return { open: false, reason: "after-closing" };
    }
    return { open: true, closesAt: special.closingTime };
  }

  const todayHours = branch.openingHours.find((entry) => entry.dayOfWeek === local.dayOfWeek);
  if (!todayHours || todayHours.isClosed) {
    return { open: false, reason: "closed-today" };
  }

  const opens = timeToMinutes(todayHours.openingTime);
  const closes = timeToMinutes(todayHours.closingTime);
  if (local.minutes < opens) {
    return { open: false, reason: "before-opening", opensAt: todayHours.openingTime };
  }
  if (local.minutes >= closes) {
    return { open: false, reason: "after-closing" };
  }
  return { open: true, closesAt: todayHours.closingTime };
}

export interface SlotOptions {
  intervalMinutes: number;
  minLeadMinutes: number;
  /** Minutos antes del cierre en que ya no se aceptan reservas. */
  bufferBeforeCloseMinutes?: number;
  now?: Date;
}

/**
 * Franjas de reserva disponibles para una fecha (yyyy-mm-dd) en una sucursal.
 * Devuelve [] si la sucursal no abre ese día.
 */
export function getAvailableTimeSlots(
  branch: Branch,
  isoDate: string,
  options: SlotOptions,
): string[] {
  const { intervalMinutes, minLeadMinutes, bufferBeforeCloseMinutes = 60 } = options;
  const now = options.now ?? new Date();

  const special = branch.specialHours.find((entry) => entry.date === isoDate);
  let openingTime: string | undefined;
  let closingTime: string | undefined;

  if (special) {
    if (special.isClosed) return [];
    openingTime = special.openingTime;
    closingTime = special.closingTime;
  } else {
    // El día de la semana de una fecha ISO es independiente de la zona del
    // servidor si se calcula sobre el mediodía UTC de esa fecha.
    const dayOfWeek = new Date(`${isoDate}T12:00:00Z`).getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const hours = branch.openingHours.find((entry) => entry.dayOfWeek === dayOfWeek);
    if (!hours || hours.isClosed) return [];
    openingTime = hours.openingTime;
    closingTime = hours.closingTime;
  }

  if (!openingTime || !closingTime) return [];

  const opens = timeToMinutes(openingTime);
  const lastSlot = timeToMinutes(closingTime) - bufferBeforeCloseMinutes;

  const local = getLocalDateParts(now, branch.timezone);
  const isToday = local.isoDate === isoDate;
  const earliest = isToday ? local.minutes + minLeadMinutes : 0;

  const slots: string[] = [];
  for (let minutes = opens; minutes <= lastSlot; minutes += intervalMinutes) {
    if (minutes >= earliest) {
      slots.push(minutesToTime(minutes));
    }
  }
  return slots;
}

/** Comprueba que una fecha ISO esté entre hoy y `maxAdvanceDays` días en el futuro. */
export function isDateWithinBookingWindow(
  isoDate: string,
  maxAdvanceDays: number,
  timezone: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const today = getLocalDateParts(now, timezone).isoDate;
  if (isoDate < today) return false;
  const limit = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
  const limitIso = getLocalDateParts(limit, timezone).isoDate;
  return isoDate <= limitIso;
}
