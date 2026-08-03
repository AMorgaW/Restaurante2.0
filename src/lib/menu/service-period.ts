import { restaurantConfig } from "@/config/restaurant";

export type ServicePeriod = "lunch" | "dinner" | "closed";

export interface ServiceSnapshot {
  /** Instante resuelto por el servidor y reutilizado en el primer render cliente. */
  observedAt: string;
  period: ServicePeriod;
}

/** Instantánea determinista para laboratorios y pruebas que no montan una página servidor. */
export const DEFAULT_SERVICE_SNAPSHOT: ServiceSnapshot = {
  observedAt: "2026-01-01T12:00:00-05:00",
  period: "lunch",
};

export const RESTAURANT_TIME_ZONE = restaurantConfig.timezone;

const LUNCH_START_SECONDS = 7 * 60 * 60;
const DINNER_START_SECONDS = 17 * 60 * 60;
const CLOSED_START_SECONDS = 22 * 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

interface ZonedClockParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Extrae un reloj estable de un instante usando siempre la zona del restaurante. */
export function getZonedClockParts(
  instant: Date,
  timeZone: string = RESTAURANT_TIME_ZONE,
): ZonedClockParts {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return {
    hours: Number.parseInt(parts.hour ?? "0", 10),
    minutes: Number.parseInt(parts.minute ?? "0", 10),
    seconds: Number.parseInt(parts.second ?? "0", 10),
  };
}

/** Función pura que implementa los límites exactos 07:00 / 17:00 / 22:00. */
export function resolveServicePeriod(
  instant: Date,
  timeZone: string = RESTAURANT_TIME_ZONE,
): ServicePeriod {
  const clock = getZonedClockParts(instant, timeZone);
  const seconds = clock.hours * 60 * 60 + clock.minutes * 60 + clock.seconds;
  if (seconds >= LUNCH_START_SECONDS && seconds < DINNER_START_SECONDS) return "lunch";
  if (seconds >= DINNER_START_SECONDS && seconds < CLOSED_START_SECONDS) return "dinner";
  return "closed";
}

export function createServiceSnapshot(
  instant: Date,
  timeZone: string = RESTAURANT_TIME_ZONE,
): ServiceSnapshot {
  return { observedAt: instant.toISOString(), period: resolveServicePeriod(instant, timeZone) };
}

/** Milisegundos hasta el próximo cambio, sin consultar la zona del dispositivo. */
export function millisecondsUntilNextServiceBoundary(
  instant: Date,
  timeZone: string = RESTAURANT_TIME_ZONE,
): number {
  const clock = getZonedClockParts(instant, timeZone);
  const seconds = clock.hours * 60 * 60 + clock.minutes * 60 + clock.seconds;
  const target =
    seconds < LUNCH_START_SECONDS
      ? LUNCH_START_SECONDS
      : seconds < DINNER_START_SECONDS
        ? DINNER_START_SECONDS
        : seconds < CLOSED_START_SECONDS
          ? CLOSED_START_SECONDS
          : SECONDS_PER_DAY + LUNCH_START_SECONDS;
  return Math.max((target - seconds) * 1000 - instant.getMilliseconds(), 0);
}

export const SERVICE_PERIOD_COPY: Record<
  ServicePeriod,
  { label: string; description: string }
> = {
  lunch: { label: "Almuerzo", description: "Disponible hasta las 5:00 p. m." },
  dinner: { label: "Cena", description: "Disponible hasta las 10:00 p. m." },
  closed: { label: "Cerrado", description: "Abrimos a las 7:00 a. m." },
};
