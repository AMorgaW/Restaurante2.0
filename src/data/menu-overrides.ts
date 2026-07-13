import type { MenuItemOverride } from "@/types/menu";

/**
 * ============================================================
 * Overrides manuales del menú, editables por el restaurante.
 *
 * La clave es el `slug` generado (ver src/data/generated/menu-manifest.ts
 * o artifacts/image-report.json). Aquí se corrigen nombres, categorías,
 * precios, descripciones, etiquetas, disponibilidad, destacados,
 * ingredientes, alérgenos y modificadores sin tocar el generador.
 *
 * ⚠ Los ingredientes listados provienen EXPLÍCITAMENTE del nombre del
 * archivo original; no se inventan datos alimentarios.
 * ============================================================
 */
export const menuOverrides: Record<string, MenuItemOverride> = {
  "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de": {
    featured: true,
    shortName: "Parrillada de ternera completa",
    tags: ["Parrilla", "Para compartir"],
    ingredients: [
      "Ternera a la parrilla",
      "Cebollas",
      "Jalapeño",
      "Frijoles",
      "Arroz",
      "Pico de gallo",
      "Guacamole",
      "Crema",
      "Lima",
    ],
    modifierGroups: [
      {
        id: "termino",
        name: "Término de la carne",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { id: "medio", name: "Término medio", additionalPrice: 0, available: true },
          { id: "tres-cuartos", name: "Tres cuartos", additionalPrice: 0, available: true },
          { id: "bien-asado", name: "Bien asado", additionalPrice: 0, available: true },
        ],
      },
      {
        id: "extras",
        name: "Extras",
        required: false,
        minSelections: 0,
        maxSelections: 3,
        options: [
          { id: "guacamole-extra", name: "Guacamole extra", additionalPrice: 4000, available: true },
          { id: "arroz-adicional", name: "Arroz adicional", additionalPrice: 3500, available: true },
          { id: "tortillas", name: "Porción de tortillas", additionalPrice: 2500, available: true },
        ],
      },
    ],
  },
  "plato-de-carne-asada": {
    featured: true,
    tags: ["Clásico de la casa"],
  },
  "sopa-de-maiz-con-arroz-y-frijoles": {
    tags: ["Receta tradicional"],
    ingredients: ["Maíz", "Arroz", "Frijoles"],
  },
  "carne-asada-falda-de-res-con-ensalada-arroz-frijoles-y-jalapenos": {
    ingredients: ["Falda de res", "Ensalada", "Arroz", "Frijoles", "Jalapeños"],
  },
  "carne-asada-plato-con-cebolleta": {
    preparationMinutes: 20,
  },
};
