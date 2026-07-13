/**
 * Emoji presentacional por categoría (lenguaje de chips del video de
 * referencia: "🥦 Healthy", "🍲 Soup"). Solo decoración de interfaz
 * (`aria-hidden`); el nombre visible sigue siendo el de la categoría.
 */
const CATEGORY_EMOJI: Record<string, string> = {
  desayunos: "🍳",
  entradas: "🥟",
  sopas: "🍲",
  ensaladas: "🥗",
  hamburguesas: "🍔",
  pizzas: "🍕",
  pastas: "🍝",
  mexicana: "🌮",
  pollo: "🍗",
  carnes: "🥩",
  "pescados-y-mariscos": "🐟",
  postres: "🍰",
  bebidas: "🥤",
  especialidades: "✨",
};

export function getCategoryEmoji(slug: string): string {
  return CATEGORY_EMOJI[slug] ?? "🍽️";
}
