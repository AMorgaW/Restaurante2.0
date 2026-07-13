/**
 * Generación DETERMINISTA de contenido de demostración (precios y
 * descripciones) cuando los archivos de imagen no aportan metadatos.
 *
 * ⚠ CONTENIDO DE DEMOSTRACIÓN: los precios generados aquí deben ser
 * revisados y reemplazados por el restaurante (vía `src/data/menu-overrides.ts`
 * o el panel de administración) antes de usarse comercialmente.
 */

/** Hash FNV-1a de 32 bits: estable entre ejecuciones y plataformas. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Rangos de precio por categoría en unidades menores (COP). */
const PRICE_RANGES: Record<string, [min: number, max: number]> = {
  desayunos: [12000, 24000],
  entradas: [8000, 18000],
  sopas: [15000, 28000],
  ensaladas: [18000, 32000],
  hamburguesas: [22000, 38000],
  pizzas: [28000, 52000],
  pastas: [26000, 42000],
  mexicana: [18000, 36000],
  pollo: [24000, 45000],
  carnes: [38000, 62000],
  "pescados-y-mariscos": [32000, 58000],
  postres: [8000, 16000],
  bebidas: [5000, 14000],
  especialidades: [25000, 48000],
};

const PRICE_STEP = 500;

/** Precio demo determinista: mismo slug → mismo precio, siempre. */
export function demoPriceFor(slug: string, categorySlug: string): number {
  const [min, max] = PRICE_RANGES[categorySlug] ?? PRICE_RANGES.especialidades ?? [20000, 40000];
  const steps = Math.floor((max - min) / PRICE_STEP) + 1;
  const offset = stableHash(slug) % steps;
  return min + offset * PRICE_STEP;
}

/**
 * Descripciones breves y naturales que NO afirman ingredientes
 * desconocidos. Se rotan de forma determinista por slug.
 */
const DESCRIPTION_TEMPLATES: Record<string, string[]> = {
  sopas: [
    "Receta de la casa servida bien caliente, reconfortante a cualquier hora.",
    "Preparación casera pensada para acompañar tus días con calma y sabor.",
  ],
  carnes: [
    "Preparada en nuestra parrilla con el punto y el sazón de la casa.",
    "Cocción a la brasa pensada para los amantes del buen sabor.",
    "Directo de la parrilla a tu mesa, con acompañamientos de la casa.",
  ],
  pollo: [
    "Dorado en su punto y servido con el toque de la casa.",
    "Preparación jugosa pensada para disfrutar sin prisa.",
  ],
  mexicana: [
    "Sabor inspirado en la cocina mexicana, preparado al momento.",
    "Una preparación vibrante para los amantes del picante moderado.",
  ],
  especialidades: [
    "Una opción preparada para disfrutar de una experiencia llena de sabor.",
    "Selección de la casa, preparada al momento con dedicación.",
  ],
};

export function demoDescriptionFor(slug: string, categorySlug: string): string {
  const templates =
    DESCRIPTION_TEMPLATES[categorySlug] ?? DESCRIPTION_TEMPLATES.especialidades ?? [];
  const fallback = "Una opción preparada para disfrutar de una experiencia llena de sabor.";
  if (templates.length === 0) return fallback;
  return templates[stableHash(`${slug}-desc`) % templates.length] ?? fallback;
}
