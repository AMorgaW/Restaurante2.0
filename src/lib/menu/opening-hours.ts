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
