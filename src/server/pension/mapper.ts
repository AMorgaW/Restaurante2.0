import type {
  PensionConsumptionStatus,
  PensionConsumptionView,
  PensionMembershipStatus,
  PensionMembershipView,
  PensionMenuCategoryView,
  PensionMenuItemView,
  PensionMenuPeriod,
  PensionMenuStatus,
  PensionMenuView,
  PensionPaymentMethod,
  PensionPlanModality,
  PensionPlanView,
} from "@/server/pension/types";

export type PensionPlanRow = {
  id: string;
  name: string;
  description: string | null;
  public_price: number;
  currency: string;
  modality: string;
  included_periods: string[];
  default_meal_limit: number | null;
  duration_days: number | null;
  is_active: boolean;
};

export type PensionMembershipRow = {
  id: string;
  profile_id: string;
  plan_id: string;
  branch_id: string;
  status: string;
  modality: string;
  public_price_snapshot: number;
  agreed_price: number | null;
  payment_method: string | null;
  payment_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  meal_limit: number | null;
  meals_consumed: number;
  activated_at: string | null;
};

export type PensionMenuRow = {
  id: string;
  branch_id: string;
  service_date: string;
  period: string;
  status: string;
  note: string | null;
};

export type PensionMenuCategoryRow = {
  id: string;
  menu_id: string;
  category: string;
  label: string;
  is_required: boolean;
  max_selections: number;
  display_order: number;
};

export type PensionMenuItemRow = {
  id: string;
  menu_category_id: string;
  menu_item_id: string;
  is_included: boolean;
  surcharge_amount: number;
  is_available: boolean;
  display_order: number;
};

export type PensionConsumptionRow = {
  id: string;
  membership_id: string;
  menu_id: string;
  order_id: string;
  status: string;
  meals_used: number;
  surplus_total: number;
  created_at: string;
  reversed_at: string | null;
};

export type MenuItemNameRow = {
  id: string;
  name: string;
  image_path: string | null;
};

const MEMBERSHIP_STATUSES = new Set<PensionMembershipStatus>([
  "pending",
  "active",
  "suspended",
  "expired",
  "cancelled",
]);

const MODALITIES = new Set<PensionPlanModality>(["meal_count", "calendar_period", "hybrid"]);
const PERIODS = new Set<PensionMenuPeriod>(["lunch", "dinner"]);
const MENU_STATUSES = new Set<PensionMenuStatus>(["draft", "published", "closed"]);
const PAYMENT_METHODS = new Set<PensionPaymentMethod>([
  "cash",
  "bank_transfer",
  "in_person_card",
  "other",
]);
const CONSUMPTION_STATUSES = new Set<PensionConsumptionStatus>(["confirmed", "reversed"]);

function asMembershipStatus(value: string): PensionMembershipStatus {
  return MEMBERSHIP_STATUSES.has(value as PensionMembershipStatus)
    ? (value as PensionMembershipStatus)
    : "pending";
}

function asModality(value: string): PensionPlanModality {
  return MODALITIES.has(value as PensionPlanModality)
    ? (value as PensionPlanModality)
    : "calendar_period";
}

function asPeriod(value: string): PensionMenuPeriod {
  return PERIODS.has(value as PensionMenuPeriod) ? (value as PensionMenuPeriod) : "lunch";
}

function asMenuStatus(value: string): PensionMenuStatus {
  return MENU_STATUSES.has(value as PensionMenuStatus) ? (value as PensionMenuStatus) : "draft";
}

function asPaymentMethod(value: string | null): PensionPaymentMethod | undefined {
  if (!value) return undefined;
  return PAYMENT_METHODS.has(value as PensionPaymentMethod)
    ? (value as PensionPaymentMethod)
    : undefined;
}

function asConsumptionStatus(value: string): PensionConsumptionStatus {
  return CONSUMPTION_STATUSES.has(value as PensionConsumptionStatus)
    ? (value as PensionConsumptionStatus)
    : "confirmed";
}

/** Display-only: calendar_period ends at startsAt + 29 days (matches private.calendar_period_ends_at). */
export function previewCalendarEndsAt(startsAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startsAt.trim());
  if (!match) return startsAt;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + 29);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function mapPensionPlanRow(row: PensionPlanRow): PensionPlanView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    publicPrice: row.public_price,
    currency: row.currency,
    modality: asModality(row.modality),
    includedPeriods: (row.included_periods ?? [])
      .filter((period): period is PensionMenuPeriod => PERIODS.has(period as PensionMenuPeriod)),
    defaultMealLimit: row.default_meal_limit,
    durationDays: row.duration_days,
    isActive: row.is_active,
  };
}

export function mapPensionMembershipRow(
  row: PensionMembershipRow,
  extras?: {
    profileName?: string | null;
    profileEmail?: string | null;
    planName?: string | null;
  },
): PensionMembershipView {
  return {
    id: row.id,
    profileId: row.profile_id,
    ...(extras?.profileName ? { profileName: extras.profileName } : {}),
    ...(extras?.profileEmail ? { profileEmail: extras.profileEmail } : {}),
    planId: row.plan_id,
    ...(extras?.planName ? { planName: extras.planName } : {}),
    branchId: row.branch_id,
    status: asMembershipStatus(row.status),
    modality: asModality(row.modality),
    publicPrice: row.public_price_snapshot,
    ...(row.agreed_price != null ? { agreedPrice: row.agreed_price } : {}),
    ...(asPaymentMethod(row.payment_method)
      ? { paymentMethod: asPaymentMethod(row.payment_method) }
      : {}),
    ...(row.payment_date ? { paymentDate: row.payment_date } : {}),
    ...(row.starts_at ? { startsAt: row.starts_at } : {}),
    ...(row.ends_at ? { endsAt: row.ends_at } : {}),
    ...(row.meal_limit != null ? { mealLimit: row.meal_limit } : {}),
    mealsConsumed: row.meals_consumed,
    ...(row.activated_at ? { activatedAt: row.activated_at } : {}),
  };
}

export function mapPensionMenuItemRow(
  row: PensionMenuItemRow,
  menuItem?: MenuItemNameRow | null,
): PensionMenuItemView {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: menuItem?.name ?? row.menu_item_id,
    isIncluded: row.is_included,
    surchargeAmount: row.surcharge_amount,
    isAvailable: row.is_available,
    displayOrder: row.display_order,
    ...(menuItem?.image_path ? { imagePath: menuItem.image_path } : {}),
  };
}

export function mapPensionMenuCategoryRow(
  row: PensionMenuCategoryRow,
  items: PensionMenuItemView[],
): PensionMenuCategoryView {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    isRequired: row.is_required,
    maxSelections: row.max_selections,
    displayOrder: row.display_order,
    items: [...items].sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

export function mapPensionMenuRow(
  row: PensionMenuRow,
  categories: PensionMenuCategoryView[],
  options?: { consumedByMe?: boolean },
): PensionMenuView {
  return {
    id: row.id,
    branchId: row.branch_id,
    serviceDate: row.service_date,
    period: asPeriod(row.period),
    status: asMenuStatus(row.status),
    ...(row.note ? { note: row.note } : {}),
    categories: [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    ...(options?.consumedByMe != null ? { consumedByMe: options.consumedByMe } : {}),
  };
}

export function mapPensionConsumptionRow(
  row: PensionConsumptionRow,
  menu?: Pick<PensionMenuRow, "service_date" | "period"> | null,
): PensionConsumptionView {
  return {
    id: row.id,
    membershipId: row.membership_id,
    menuId: row.menu_id,
    orderId: row.order_id,
    status: asConsumptionStatus(row.status),
    mealsUsed: row.meals_used,
    surplusTotal: row.surplus_total,
    createdAt: row.created_at,
    ...(menu?.service_date ? { serviceDate: menu.service_date } : {}),
    ...(menu?.period ? { period: asPeriod(menu.period) } : {}),
    ...(row.reversed_at ? { reversedAt: row.reversed_at } : {}),
  };
}

export function commercialDateInTimezone(timezone: string, now = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}
