import { removeDiacritics } from "@/lib/images/naming";

/** Normaliza texto para búsqueda: sin tildes, minúsculas, espacios colapsados. */
export function normalizeForSearch(value: string): string {
  return removeDiacritics(value).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Comprueba si `haystack` contiene `needle` ignorando tildes y mayúsculas. */
export function fuzzyIncludes(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeForSearch(needle);
  if (normalizedNeedle.length === 0) return true;
  return normalizeForSearch(haystack).includes(normalizedNeedle);
}
