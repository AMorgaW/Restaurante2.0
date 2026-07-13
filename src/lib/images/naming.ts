/**
 * Conversión de nombres de archivo de imagen a nombres de plato legibles.
 * Estas funciones están cubiertas por pruebas unitarias exhaustivas
 * (tests/unit/naming.test.ts) porque son la base del menú completo.
 */

export const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"] as const;

/** Comprueba por nombre si la extensión es de imagen soportada (case-insensitive). */
export function hasSupportedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Elimina la extensión final soportada, conservando el resto intacto. */
export function stripExtension(filename: string): string {
  const lower = filename.toLowerCase();
  for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return filename.slice(0, filename.length - ext.length);
    }
  }
  return filename;
}

export interface ParsedFilename {
  /** Nombre visible del plato (primera frase si el archivo contenía varias). */
  fullName: string;
  /** Segunda frase del nombre del archivo, útil como descripción. */
  descriptionFromFilename?: string;
}

/** Palabras totalmente en mayúsculas que se conservan (acrónimos reconocibles). */
const KNOWN_ACRONYMS = new Set(["BBQ", "IPA", "XL", "XXL", "VIP", "USA"]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function capitalizeNaturally(value: string): string {
  if (value.length === 0) return value;
  const words = value.split(" ");
  const isAllUpper = value === value.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(value);
  const processed = words.map((word) => {
    if (KNOWN_ACRONYMS.has(word.toUpperCase()) && word === word.toUpperCase()) {
      return word.toUpperCase();
    }
    if (isAllUpper) {
      return word.toLowerCase();
    }
    return word;
  });
  let result = processed.join(" ");
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

/**
 * Convierte el nombre base de un archivo en un nombre de plato profesional.
 *
 * Reglas:
 * - `_` y `-` funcionan como separadores → espacios.
 * - Los puntos intermedios funcionan como separadores de frase: la primera
 *   frase es el nombre y el resto se conserva como descripción.
 * - Se conservan tildes, eñes, comas y paréntesis.
 * - Se colapsan espacios duplicados y se corrige la capitalización inicial.
 */
export function parseFilename(filename: string): ParsedFilename {
  let base = stripExtension(filename);

  // Separadores clásicos de archivos.
  base = base.replace(/_/g, " ");
  // Guiones como separadores (rodeados o no de espacios). Conserva rangos numéricos tipo "2-3".
  base = base.replace(/(?<!\d)-|-(?!\d)/g, " ");

  // Puntos pegados a la palabra siguiente actúan como separadores de palabra
  // ("hamburguesa.doble.artesanal"), conservando decimales ("1.5").
  base = base.replace(/(?<!\d)\.(?=\S)/g, " ");
  base = base.replace(/(?<=\d)\.(?=[^\d\s])/g, " ");

  // Puntos finales colgantes ("nombre..jpg" → "nombre.").
  base = base.replace(/[.\s]+$/g, "");

  // Un punto seguido de espacio separa frases: la primera es el nombre
  // y el resto se conserva como descripción proveniente del archivo.
  const sentences = base
    .split(/\.\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);

  if (sentences.length === 0) {
    return { fullName: "" };
  }

  const fullName = capitalizeNaturally(sentences[0] ?? "");
  const rest = sentences.slice(1).join(". ");
  const description = rest.length > 0 ? capitalizeNaturally(rest) : undefined;

  return {
    fullName,
    descriptionFromFilename: description,
  };
}

const COMBINING_MARKS_START = 0x0300;
const COMBINING_MARKS_END = 0x036f;

/**
 * Elimina diacríticos conservando la letra base (á→a, ñ→n).
 * Implementado con code points explícitos para evitar caracteres
 * combinantes invisibles en el código fuente.
 */
export function removeDiacritics(value: string): string {
  let result = "";
  for (const char of value.normalize("NFD")) {
    const code = char.codePointAt(0) ?? 0;
    if (code < COMBINING_MARKS_START || code > COMBINING_MARKS_END) {
      result += char;
    }
  }
  return result;
}

const MAX_SLUG_LENGTH = 80;

/** Genera un slug URL-safe estable a partir de un nombre. */
export function slugify(value: string): string {
  let slug = removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length > MAX_SLUG_LENGTH) {
    const cut = slug.slice(0, MAX_SLUG_LENGTH);
    const lastHyphen = cut.lastIndexOf("-");
    slug = lastHyphen > 40 ? cut.slice(0, lastHyphen) : cut;
  }
  return slug;
}

/**
 * Resuelve colisiones de slug añadiendo un sufijo numérico estable.
 * El mapa `used` debe reutilizarse durante toda la generación.
 */
export function ensureUniqueSlug(slug: string, used: Map<string, number>): string {
  const base = slug.length > 0 ? slug : "plato";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  if (count === 0) {
    return base;
  }
  const candidate = `${base}-${count + 1}`;
  // Garantiza unicidad incluso si "-2" ya existía como slug natural.
  return ensureUniqueSlug(candidate, used);
}
