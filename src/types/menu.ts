/** Metadatos técnicos de la imagen asociada a un plato. */
export interface MenuImageMeta {
  /** Nombre original exacto del archivo dentro de `images/` (nunca se modifica). */
  originalFilename: string;
  /** Ruta pública de la copia normalizada, p. ej. `/generated/menu/carne-asada.jpg`. */
  publicPath: string;
  width: number;
  height: number;
  /** Relación ancho/alto redondeada a 3 decimales. */
  aspectRatio: number;
  hasAlpha: boolean;
  /** Placeholder ligero en base64 para `next/image`. */
  blurDataURL: string;
  bytes: number;
}

/** Elemento crudo del manifiesto generado desde `images/`. */
export interface MenuManifestItem {
  id: string;
  slug: string;
  /** Nombre completo legible derivado del nombre del archivo. */
  fullName: string;
  /** Texto descriptivo adicional si el nombre del archivo contenía una segunda frase. */
  descriptionFromFilename?: string;
  categorySlug: string;
  image: MenuImageMeta;
}

export interface ModifierOption {
  id: string;
  name: string;
  /** Precio adicional en unidades menores de la moneda configurada. */
  additionalPrice: number;
  available: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

/** Plato final que consume la interfaz (manifiesto + overrides + demo). */
export interface MenuItem {
  id: string;
  slug: string;
  fullName: string;
  /** Versión corta SOLO si existe un override manual; nunca truncado automático. */
  shortName?: string;
  categorySlug: string;
  shortDescription: string;
  description?: string;
  /** Precio base en unidades menores (COP no usa decimales). */
  price: number;
  available: boolean;
  featured: boolean;
  tags: string[];
  ingredients?: string[];
  allergens?: string[];
  /** Solo se muestra si es un dato configurado explícitamente. */
  preparationMinutes?: number;
  displayOrder: number;
  image: MenuImageMeta;
  modifierGroups: ModifierGroup[];
}

export interface CategoryInfo {
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
}

/** Override manual editable por el restaurante en `src/data/menu-overrides.ts`. */
export interface MenuItemOverride {
  fullName?: string;
  shortName?: string;
  categorySlug?: string;
  shortDescription?: string;
  description?: string;
  price?: number;
  available?: boolean;
  featured?: boolean;
  tags?: string[];
  ingredients?: string[];
  allergens?: string[];
  preparationMinutes?: number;
  displayOrder?: number;
  modifierGroups?: ModifierGroup[];
}

/** Ajustes de administración demo aplicados en el navegador. */
export interface AdminItemOverride {
  price?: number;
  available?: boolean;
  featured?: boolean;
  shortDescription?: string;
}
