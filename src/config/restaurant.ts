import type { Branch, Coupon, CurrencyConfig, Promotion } from "@/types/restaurant";

/**
 * ============================================================
 * Configuración central del restaurante.
 *
 * TODO EL CONTENIDO COMERCIAL DE ESTE ARCHIVO ES DE DEMOSTRACIÓN
 * y debe ser verificado/reemplazado por el restaurante real antes
 * de producción: nombre, teléfonos, direcciones, coordenadas,
 * horarios, impuestos y tarifas. Ver README → "Contenido que
 * necesita validación".
 * ============================================================
 */

export const currencyConfig: CurrencyConfig = {
  code: "COP",
  locale: "es-CO",
  decimals: 0,
};

const defaultOpeningHours: Branch["openingHours"] = [
  { dayOfWeek: 0, openingTime: "12:00", closingTime: "17:00", isClosed: false },
  { dayOfWeek: 1, openingTime: "11:30", closingTime: "21:30", isClosed: false },
  { dayOfWeek: 2, openingTime: "11:30", closingTime: "21:30", isClosed: false },
  { dayOfWeek: 3, openingTime: "11:30", closingTime: "21:30", isClosed: false },
  { dayOfWeek: 4, openingTime: "11:30", closingTime: "22:00", isClosed: false },
  { dayOfWeek: 5, openingTime: "11:30", closingTime: "23:00", isClosed: false },
  { dayOfWeek: 6, openingTime: "12:00", closingTime: "23:00", isClosed: false },
];

export const branches: Branch[] = [
  {
    id: "branch-centro",
    name: "Casa Brasa Centro",
    slug: "centro",
    address: "Calle 10 # 5-51 (dirección de demostración)",
    city: "Bogotá",
    latitude: 4.598056,
    longitude: -74.075833,
    phone: "+57 601 000 0001",
    whatsapp: "+573000000001",
    email: "centro@casabrasa-demo.example",
    timezone: "America/Bogota",
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryFee: 6000,
    deliveryAreaNote: "Cobertura de demostración: hasta 5 km a la redonda.",
    status: "active",
    openingHours: defaultOpeningHours,
    specialHours: [],
  },
  {
    id: "branch-norte",
    name: "Casa Brasa Norte",
    slug: "norte",
    address: "Carrera 15 # 93-30 (dirección de demostración)",
    city: "Bogotá",
    latitude: 4.678056,
    longitude: -74.056389,
    phone: "+57 601 000 0002",
    whatsapp: "+573000000002",
    email: "norte@casabrasa-demo.example",
    timezone: "America/Bogota",
    pickupEnabled: true,
    deliveryEnabled: false,
    deliveryFee: 0,
    deliveryAreaNote: "Esta sucursal solo ofrece recogida en tienda.",
    status: "active",
    openingHours: defaultOpeningHours,
    specialHours: [],
  },
];

export const restaurantConfig = {
  name: "Casa Brasa",
  shortName: "Casa Brasa",
  slug: "casa-brasa",
  monogram: "CB",
  tagline: "Cocina a la brasa, sabor de casa",
  description:
    "Restaurante de parrilla y cocina casera. Carnes a la brasa, sopas tradicionales y acompañamientos preparados al momento.",
  language: "es",
  timezone: "America/Bogota",
  currency: currencyConfig,
  contact: {
    phone: "+57 601 000 0000",
    whatsapp: "+573000000000",
    email: "hola@casabrasa-demo.example",
  },
  legalName: "Casa Brasa S.A.S. (razón social de demostración)",
  defaultBranchId: "branch-centro",
  branches,
  checkout: {
    /** Impuesto de demostración (impoconsumo CO 8%); confirmar con contabilidad. */
    taxRate: 0.08,
    /** Tarifa de servicio opcional (0 = desactivada). */
    serviceFeeRate: 0,
    /** Porcentajes de propina sugeridos. */
    tipOptions: [0, 5, 10, 15] as number[],
    /** Pedido mínimo para domicilio, en unidades menores. */
    deliveryMinimum: 25000,
    /** Máximo de unidades por línea para prevenir cantidades absurdas. */
    maxQuantityPerLine: 20,
  },
  demo: {
    orderPrefix: "CB",
  },
} as const;

export const coupons: Coupon[] = [
  {
    code: "BIENVENIDA10",
    type: "percent",
    value: 10,
    description: "10% de descuento de bienvenida (cupón de demostración).",
    active: true,
  },
];

export const promotions: Promotion[] = [
  {
    id: "promo-bienvenida",
    title: "10% en tu primer pedido",
    description: "Usa el cupón BIENVENIDA10 al finalizar tu pedido y recibe el 10% de descuento.",
    badge: "Cupón",
    couponCode: "BIENVENIDA10",
    active: true,
  },
  {
    id: "promo-parrilla",
    title: "Jueves de parrilla",
    description:
      "Todos los jueves, nuestra selección de carnes a la brasa protagoniza la casa. Pregunta en tu sucursal por la recomendación del día.",
    badge: "Especial",
    active: true,
  },
];
