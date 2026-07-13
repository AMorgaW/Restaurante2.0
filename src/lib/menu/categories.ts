import type { CategoryInfo } from "@/types/menu";
import { removeDiacritics } from "@/lib/images/naming";

/**
 * Catálogo de categorías conocidas. `especialidades` es el fallback
 * cuando ninguna regla conservadora coincide.
 */
export const CATEGORIES: CategoryInfo[] = [
  { slug: "desayunos", name: "Desayunos", description: "Para empezar el día", displayOrder: 1 },
  { slug: "entradas", name: "Entradas", description: "Para abrir el apetito", displayOrder: 2 },
  { slug: "sopas", name: "Sopas", description: "Recetas calientes de la casa", displayOrder: 3 },
  { slug: "ensaladas", name: "Ensaladas", description: "Frescas y completas", displayOrder: 4 },
  { slug: "hamburguesas", name: "Hamburguesas", description: "Al carbón", displayOrder: 5 },
  { slug: "pizzas", name: "Pizzas", description: "Al horno", displayOrder: 6 },
  { slug: "pastas", name: "Pastas", description: "Tradición italiana", displayOrder: 7 },
  {
    slug: "mexicana",
    name: "Tacos y mexicana",
    description: "Sabores de México",
    displayOrder: 8,
  },
  { slug: "pollo", name: "Pollo", description: "Jugoso y dorado", displayOrder: 9 },
  { slug: "carnes", name: "Carnes", description: "A la brasa y a la parrilla", displayOrder: 10 },
  {
    slug: "pescados-y-mariscos",
    name: "Pescados y mariscos",
    description: "Del mar a la mesa",
    displayOrder: 11,
  },
  { slug: "postres", name: "Postres", description: "El final dulce", displayOrder: 12 },
  { slug: "bebidas", name: "Bebidas", description: "Para acompañar", displayOrder: 13 },
  {
    slug: "especialidades",
    name: "Especialidades",
    description: "Selección de la casa",
    displayOrder: 14,
  },
];

export const FALLBACK_CATEGORY_SLUG = "especialidades";

export function getCategoryBySlug(slug: string): CategoryInfo {
  return (
    CATEGORIES.find((category) => category.slug === slug) ??
    (CATEGORIES.find((category) => category.slug === FALLBACK_CATEGORY_SLUG) as CategoryInfo)
  );
}

interface CategoryRule {
  slug: string;
  /** Palabras que deben coincidir como palabra completa (sin tildes, minúsculas). */
  keywords?: string[];
  /** La regla solo aplica si el nombre EMPIEZA por alguno de estos prefijos. */
  startsWith?: string[];
}

/**
 * Reglas conservadoras y ordenadas por prioridad. Notas de diseño:
 * - "sopa"/"ensalada" solo cuentan al inicio del nombre para no
 *   reclasificar platos que las mencionan como acompañamiento
 *   ("carne asada con ensalada").
 * - La categoría mexicana solo coincide con TIPOS de plato (taco,
 *   burrito…), no con ingredientes (guacamole, jalapeño), porque los
 *   ingredientes aparecen en platos de otras categorías.
 */
const RULES: CategoryRule[] = [
  { slug: "sopas", startsWith: ["sopa", "crema de", "caldo", "ajiaco", "sancocho", "consome"] },
  { slug: "ensaladas", startsWith: ["ensalada"] },
  {
    slug: "desayunos",
    keywords: ["desayuno", "huevos", "panqueques", "waffles", "omelette", "calentado"],
  },
  { slug: "hamburguesas", keywords: ["hamburguesa", "burger"] },
  { slug: "pizzas", keywords: ["pizza"] },
  {
    slug: "pastas",
    keywords: ["pasta", "spaghetti", "espagueti", "lasana", "lasagna", "ravioli", "fettuccine", "macarrones"],
  },
  {
    slug: "mexicana",
    keywords: ["taco", "tacos", "burrito", "burritos", "quesadilla", "quesadillas", "enchilada", "enchiladas", "fajita", "fajitas", "nachos"],
  },
  {
    slug: "pescados-y-mariscos",
    keywords: ["pescado", "salmon", "atun", "camaron", "camarones", "mariscos", "ceviche", "mojarra", "trucha", "pulpo", "calamares"],
  },
  { slug: "pollo", keywords: ["pollo", "alitas", "pechuga"] },
  {
    slug: "carnes",
    keywords: ["carne", "res", "ternera", "cerdo", "lomo", "costillas", "churrasco", "asado", "asada", "bistec", "chuleta", "falda", "parrillada"],
  },
  {
    slug: "entradas",
    keywords: ["entrada", "empanadas", "patacones", "croquetas", "tequenos"],
  },
  {
    slug: "postres",
    keywords: ["postre", "torta", "pastel", "helado", "brownie", "flan", "cheesecake", "tiramisu", "galletas"],
  },
  {
    slug: "bebidas",
    keywords: ["jugo", "limonada", "gaseosa", "cafe", "cerveza", "coctel", "batido", "malteada", "smoothie", "soda", "agua"],
  },
];

/**
 * Infiere la categoría de un plato a partir de su nombre visible.
 * Devuelve `especialidades` cuando no hay coincidencia confiable.
 */
export function inferCategorySlug(fullName: string): string {
  const normalized = removeDiacritics(fullName).toLowerCase();
  const words = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));

  for (const rule of RULES) {
    if (rule.startsWith?.some((prefix) => normalized.startsWith(prefix))) {
      return rule.slug;
    }
    if (rule.keywords?.some((keyword) => words.has(keyword))) {
      return rule.slug;
    }
  }
  return FALLBACK_CATEGORY_SLUG;
}
