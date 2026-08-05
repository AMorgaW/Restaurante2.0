export interface OpeningHour {
  /** 0 = domingo … 6 = sábado (convención de `Date.getDay`). */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Formato HH:mm en hora local del restaurante. */
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
}

export interface SpecialHour {
  /** Fecha ISO yyyy-mm-dd en hora local del restaurante. */
  date: string;
  openingTime?: string;
  closingTime?: string;
  isClosed: boolean;
  reason: string;
}

export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string;
  whatsapp: string;
  email: string;
  timezone: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryAreaNote: string;
  status: "active" | "inactive";
  openingHours: OpeningHour[];
  specialHours: SpecialHour[];
}

export interface CurrencyConfig {
  /** Código ISO 4217, p. ej. COP, USD, EUR. */
  code: string;
  /** Locale para Intl.NumberFormat, p. ej. es-CO. */
  locale: string;
  /** Número de decimales de la unidad menor (COP = 0). */
  decimals: number;
}

export interface Coupon {
  code: string;
  type: "percent" | "fixed";
  value: number;
  description: string;
  active: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  badge: string;
  /** Slug de plato asociado, si aplica. */
  itemSlug?: string;
  couponCode?: string;
  active: boolean;
}

export type OpeningStatus =
  | { open: true; closesAt: string }
  | { open: false; reason: "closed-today" | "before-opening" | "after-closing" | "special"; opensAt?: string };
