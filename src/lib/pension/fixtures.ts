import { menuItems } from "@/data/menu";
import type { PensionDailyMenu, PensionDemoProfile, PensionMembership, PensionPlan } from "@/lib/pension/types";

export const PENSION_DEMO_NOW = "2026-08-04T12:00:00-05:00";
export const PENSION_DEMO_BRANCH_ID = "branch-centro";

export const PENSION_DEMO_PLAN: PensionPlan = {
  id: "plan-pension-demo",
  name: "Plan mensual",
  description: "Plan calendario de 30 días (almuerzo y cena diarios) con activación presencial.",
  publicPrice: 500000,
  currency: "COP",
  modality: "calendar_period",
  lunchesIncluded: 1,
  dinnersIncluded: 1,
  totalMeals: 30,
  durationDays: 30,
  isActive: true,
  demoOnly: true,
};

export const PENSION_DEMO_PROFILES: PensionDemoProfile[] = [
  { id: "customer-no-membership", role: "customer", name: "Cliente visitante", email: "cliente.demo@example.test" },
  { id: "customer-pending", role: "customer", name: "María pendiente", email: "maria.demo@example.test" },
  { id: "customer-active", role: "customer", name: "Juan Pérez", email: "juan.demo@example.test" },
  { id: "customer-suspended", role: "customer", name: "Ana suspendida", email: "ana.demo@example.test" },
  { id: "customer-expired", role: "customer", name: "Luis vencido", email: "luis.demo@example.test" },
  { id: "customer-cancelled", role: "customer", name: "Rosa cancelada", email: "rosa.demo@example.test" },
];

export const PENSION_DEMO_MEMBERSHIPS: PensionMembership[] = [
  { id: "membership-pending", profileId: "customer-pending", planId: PENSION_DEMO_PLAN.id, status: "pending", publicPrice: 500000, agreedPrice: 450000, discount: 50000, paymentMethod: "in_person", paymentDate: "2026-08-03", observations: "Pago recibido presencialmente; pendiente de activación.", demoOnly: true },
  { id: "membership-active", profileId: "customer-active", planId: PENSION_DEMO_PLAN.id, status: "active", publicPrice: 500000, agreedPrice: 450000, discount: 50000, paymentMethod: "in_person", paymentDate: "2026-08-01", startsAt: "2026-08-01", expiresAt: "2026-08-30", modality: "calendar_period", mealsAvailable: 22, observations: "Plan mensual calendario: ends_at = starts_at + 29.", activatedAt: "2026-08-01T09:00:00-05:00", activatedBy: "demo-jefe", demoOnly: true },
  { id: "membership-suspended", profileId: "customer-suspended", planId: PENSION_DEMO_PLAN.id, status: "suspended", publicPrice: 500000, agreedPrice: 480000, discount: 20000, paymentMethod: "in_person", paymentDate: "2026-07-28", startsAt: "2026-07-28", expiresAt: "2026-08-26", modality: "calendar_period", mealsAvailable: 12, suspensionReason: "Revisión presencial pendiente.", demoOnly: true },
  { id: "membership-expired", profileId: "customer-expired", planId: PENSION_DEMO_PLAN.id, status: "expired", publicPrice: 500000, agreedPrice: 500000, discount: 0, paymentMethod: "in_person", paymentDate: "2026-06-01", startsAt: "2026-06-01", expiresAt: "2026-06-30", modality: "calendar_period", mealsAvailable: 0, demoOnly: true },
  { id: "membership-cancelled", profileId: "customer-cancelled", planId: PENSION_DEMO_PLAN.id, status: "cancelled", publicPrice: 500000, agreedPrice: 470000, discount: 30000, paymentMethod: "in_person", paymentDate: "2026-07-01", startsAt: "2026-07-01", expiresAt: "2026-07-30", modality: "calendar_period", mealsAvailable: 4, demoOnly: true },
];

const currentSoup = menuItems.find((item) => item.id === "sopa-de-maiz-con-arroz-y-frijoles");
const currentMain = menuItems.find((item) => item.id === "carne-asada-plato-con-cebolleta");
const premiumMain = menuItems.find((item) => item.id === "carne-asada-ternera-a-la-parrilla-con-cebollas-jalapeno-frijoles-arroz-pico-de");

// Opciones demo: los nombres sin productoId representan la discrepancia pendiente de catálogo.
const mainCategory = {
  id: "main",
  label: "Plato principal",
  category: "main" as const,
  required: true,
  maxSelections: 1 as const,
  options: [
    { id: "main-current", name: currentMain?.fullName ?? "Carne asada plato con cebolleta", category: "main" as const, productId: currentMain?.id, price: currentMain?.price ?? 43500, included: true, available: currentMain?.available ?? false, configured: Boolean(currentMain) },
    { id: "main-premium", name: "Parrillada de ternera", category: "main" as const, productId: premiumMain?.id, price: premiumMain?.price ?? 51500, included: false, surplusPrice: 8000, available: premiumMain?.available ?? false, configured: Boolean(premiumMain) },
    { id: "main-pollo", name: "Pollo guisado", category: "main" as const, price: 0, included: true, available: false, configured: false },
    { id: "main-molida", name: "Carne molida", category: "main" as const, price: 0, included: true, available: false, configured: false },
    { id: "main-mechada", name: "Carne mechada", category: "main" as const, price: 0, included: true, available: false, configured: false },
    { id: "main-chuleta", name: "Chuleta guisada", category: "main" as const, price: 0, included: true, available: false, configured: false },
  ],
};

const soupCategory = {
  id: "soup",
  label: "Sopa del día",
  category: "soup" as const,
  required: true,
  maxSelections: 1 as const,
  options: [
    { id: "soup-current", name: currentSoup?.fullName ?? "Sopa de maíz con arroz y frijoles", category: "soup" as const, productId: currentSoup?.id, price: currentSoup?.price ?? 0, included: true, available: currentSoup?.available ?? false, configured: Boolean(currentSoup) },
    { id: "soup-costilla", name: "Sopa de costilla", category: "soup" as const, price: 0, included: true, available: false, configured: false },
    { id: "soup-hueso", name: "Sopa de hueso", category: "soup" as const, price: 0, included: true, available: false, configured: false },
    { id: "soup-cerdo", name: "Sopa de cerdo", category: "soup" as const, price: 0, included: true, available: false, configured: false },
  ],
};

const beverageCategory = {
  id: "beverage",
  label: "Bebida",
  category: "beverage" as const,
  required: false,
  maxSelections: 1 as const,
  options: [
    { id: "beverage-juice", name: "Jugo del día", category: "beverage" as const, price: 4500, included: true, available: true, configured: true },
    { id: "beverage-lemonade", name: "Limonada natural", category: "beverage" as const, price: 5000, included: false, surplusPrice: 5000, available: true, configured: true },
  ],
};

export const PENSION_DEMO_MENUS: PensionDailyMenu[] = [
  { id: "pension-menu-2026-08-04-lunch", date: "2026-08-04", branchId: PENSION_DEMO_BRANCH_ID, period: "lunch", published: true, serviceOpen: true, categories: [mainCategory, soupCategory, beverageCategory], note: "Fixture demo; las cantidades y nombres pendientes requieren confirmación comercial.", demoOnly: true },
  { id: "pension-menu-2026-08-04-dinner", date: "2026-08-04", branchId: PENSION_DEMO_BRANCH_ID, period: "dinner", published: true, serviceOpen: true, categories: [mainCategory, beverageCategory], demoOnly: true },
  { id: "pension-menu-2026-08-05-lunch", date: "2026-08-05", branchId: PENSION_DEMO_BRANCH_ID, period: "lunch", published: false, serviceOpen: true, categories: [mainCategory, soupCategory], note: "Menú aún no publicado.", demoOnly: true },
  { id: "pension-menu-2026-08-06-lunch", date: "2026-08-06", branchId: PENSION_DEMO_BRANCH_ID, period: "lunch", published: true, serviceOpen: false, categories: [mainCategory, soupCategory], note: "El servicio está cerrado en este fixture.", demoOnly: true },
];

export const PENSION_MENU_DATES = ["2026-08-04", "2026-08-05", "2026-08-06"] as const;
