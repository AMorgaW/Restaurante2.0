/** Une clases condicionales sin dependencias externas. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Identificador aleatorio corto y URL-safe (no criptográfico para UI). */
export function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/** Normaliza un teléfono a dígitos con prefijo + opcional. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/** Valida un teléfono normalizado: 7 a 15 dígitos (E.164 laxo). */
export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/^\+/, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Fecha local de hoy en formato yyyy-mm-dd para una zona horaria. */
export function todayIso(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
