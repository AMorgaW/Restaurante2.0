/** Domain types for Supabase pension (no demoOnly). */

export type PensionMembershipStatus =
  | "pending"
  | "active"
  | "suspended"
  | "expired"
  | "cancelled";

export type PensionPlanModality = "meal_count" | "calendar_period" | "hybrid";

export type PensionPaymentMethod = "cash" | "bank_transfer" | "in_person_card" | "other";

export type PensionMenuPeriod = "lunch" | "dinner";

export type PensionMenuStatus = "draft" | "published" | "closed";

export type PensionFulfillmentType = "local" | "pickup" | "delivery";

export type PensionMembershipStatusAction =
  | "suspended"
  | "reactivated"
  | "cancelled"
  | "finalized";

export type PensionConsumptionStatus = "confirmed" | "reversed";

export interface PensionMembershipView {
  id: string;
  profileId: string;
  profileName?: string;
  profileEmail?: string;
  planId: string;
  planName?: string;
  branchId: string;
  status: PensionMembershipStatus;
  modality: PensionPlanModality;
  publicPrice: number;
  agreedPrice?: number;
  paymentMethod?: PensionPaymentMethod;
  paymentDate?: string;
  startsAt?: string;
  endsAt?: string;
  mealLimit?: number;
  mealsConsumed?: number;
  activatedAt?: string;
}

export interface PensionPlanView {
  id: string;
  name: string;
  description: string | null;
  publicPrice: number;
  currency: string;
  modality: PensionPlanModality;
  includedPeriods: PensionMenuPeriod[];
  defaultMealLimit: number | null;
  durationDays: number | null;
  isActive: boolean;
}

export interface PensionMenuItemView {
  id: string;
  menuItemId: string;
  name: string;
  isIncluded: boolean;
  surchargeAmount: number;
  isAvailable: boolean;
  displayOrder: number;
  imagePath?: string;
}

export interface PensionMenuCategoryView {
  id: string;
  category: string;
  label: string;
  isRequired: boolean;
  maxSelections: number;
  displayOrder: number;
  items: PensionMenuItemView[];
}

export interface PensionMenuView {
  id: string;
  branchId: string;
  serviceDate: string;
  period: PensionMenuPeriod;
  status: PensionMenuStatus;
  note?: string;
  categories: PensionMenuCategoryView[];
  consumedByMe?: boolean;
}

export interface PensionConsumptionView {
  id: string;
  membershipId: string;
  menuId: string;
  orderId: string;
  status: PensionConsumptionStatus;
  mealsUsed: number;
  surplusTotal: number;
  createdAt: string;
  serviceDate?: string;
  period?: PensionMenuPeriod;
  reversedAt?: string;
}

export interface PensionDayAvailability {
  lunch: PensionMenuView | null;
  dinner: PensionMenuView | null;
  lunchConsumed: boolean;
  dinnerConsumed: boolean;
}

export interface PensionCustomerSnapshot {
  membership: PensionMembershipView | null;
  plans: PensionPlanView[];
  menusByDate: Record<string, PensionDayAvailability>;
  deliveryFee: number | null;
  consumptions: PensionConsumptionView[];
  branchId: string | null;
  branchSlug: string | null;
  commercialDate: string | null;
}

export interface PensionCatalogMenuItemView {
  id: string;
  name: string;
  categorySlug: string;
  basePrice: number;
  imagePath: string | null;
  available: boolean;
}

export interface PensionBranchFeeView {
  id: string;
  slug: string;
  name: string;
  deliveryFee: number | null;
}

export interface PensionAdminSnapshot {
  memberships: PensionMembershipView[];
  plans: PensionPlanView[];
  menus: PensionMenuView[];
  branches: PensionBranchFeeView[];
  catalogMenuItems: PensionCatalogMenuItemView[];
}

export interface PensionCustomerSearchHit {
  id: string;
  name: string | null;
  email: string | null;
}

export interface CreatePensionOrderInput {
  idempotencyKey: string;
  menuId: string;
  pensionMenuItemIds: string[];
  fulfillmentType: PensionFulfillmentType;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address?: {
    street: string;
    details?: string;
    neighborhood?: string;
  };
  notes?: string;
  tipPercent?: number;
}

export interface CreatePensionOrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  consumptionId: string;
  replay: boolean;
  paymentStatus: "pending";
}

export interface CreateAndActivatePensionMembershipInput {
  customerId: string;
  planId: string;
  branchId: string;
  agreedPrice: number;
  paymentMethod: PensionPaymentMethod;
  paymentReference?: string;
  paymentDate: string;
  startsAt: string;
  mealLimit?: number | null;
  allowSurcharge?: boolean;
  reason: string;
  idempotencyKey: string;
}

export interface ActivatePensionMembershipInput {
  membershipId: string;
  agreedPrice: number;
  paymentMethod: PensionPaymentMethod;
  paymentReference?: string;
  paymentDate: string;
  startsAt: string;
  /** Required for meal_count/hybrid; ignored for calendar (DB derives ends_at). */
  endsAt?: string | null;
  /** Required for meal_count; null/0 for calendar. */
  mealLimit?: number | null;
  allowSurcharge?: boolean;
  reason: string;
  idempotencyKey: string;
}

export interface RenewPensionMembershipInput {
  membershipId: string;
  agreedPrice: number;
  paymentMethod: PensionPaymentMethod;
  paymentReference?: string;
  paymentDate: string;
  startsAt: string;
  endsAt?: string | null;
  mealLimit?: number | null;
  allowSurcharge?: boolean;
  reason: string;
  idempotencyKey: string;
}

export interface ChangePensionMembershipStatusInput {
  membershipId: string;
  action: PensionMembershipStatusAction;
  reason: string;
  idempotencyKey: string;
}

export interface SavePensionMenuDraftInput {
  branchId: string;
  serviceDate: string;
  period: PensionMenuPeriod;
  note?: string;
  idempotencyKey: string;
}

export interface UpsertPensionMenuItemInput {
  menuId: string;
  category: string;
  categoryLabel: string;
  isRequired: boolean;
  maxSelections: number;
  menuItemId: string;
  isIncluded: boolean;
  surchargeAmount: number;
  isAvailable: boolean;
  displayOrder: number;
}

export interface PublishPensionMenuInput {
  menuId: string;
  expectedStatus: PensionMenuStatus;
  idempotencyKey: string;
}

export interface ClosePensionMenuInput {
  menuId: string;
  expectedStatus: PensionMenuStatus;
  idempotencyKey: string;
}

export interface SetPensionDeliveryFeeInput {
  branchId: string;
  fee: number;
  idempotencyKey: string;
}

export interface ReversePensionOrderConsumptionInput {
  orderId: string;
  reason: string;
  idempotencyKey: string;
}
