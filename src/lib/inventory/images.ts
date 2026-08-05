import type { InventoryItem } from "@/lib/inventory/types";

/** Imágenes de plato temporales: se reemplazarán por iconos/fotos de insumos. */
const DEMO_IMAGE_BY_KEY: Record<string, string> = {
  carne: "/generated/menu/carne-asada-falda-de-res-con-ensalada-arroz-frijoles-y-jalapenos.jpg",
  cerdo: "/generated/menu/carne-asada-plato-con-cebolleta.jpg",
  costilla: "/generated/menu/plato-de-carne-asada.jpg",
  arroz: "/generated/menu/arroz-amarillo-carne-asada-frijoles.jpg",
  papa: "/generated/menu/arroz-amarillo-carne-asada-frijoles.jpg",
  yuca: "/generated/menu/sopa-de-maiz-con-arroz-y-frijoles.jpg",
  verduras: "/generated/menu/carne-asada-plato-con-cebolleta.jpg",
  aceite: "/generated/menu/sopa-de-maiz-con-arroz-y-frijoles.jpg",
  leche: "/generated/menu/sopa-de-maiz-con-arroz-y-frijoles.jpg",
};

const FALLBACK_IMAGE = "/generated/menu/plato-de-carne-asada.jpg";

export function getInventoryDemoImage(item: Pick<InventoryItem, "imageKey">): string {
  return DEMO_IMAGE_BY_KEY[item.imageKey] ?? FALLBACK_IMAGE;
}
