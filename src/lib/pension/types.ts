import type { ServicePeriod } from "@/lib/menu/service-period";

export type PensionMembershipStatus = "pending" | "active" | "suspended" | "expired" | "cancelled";
export type PensionPlanModality = "meal_count" | "calendar_period" | "hybrid";
export type PensionConsumptionStatus = "confirmed" | "rejected";
export type PensionSelectionCategory = "main" | "soup" | "beverage" | "side";

export interface PensionDemoProfile {
  id: string;
  role: "customer";
  name: string;
  email: string;
}

export interface PensionPlan {
  id: string;
  name: string;
  description: string;
  publicPrice: number;
  currency: "COP";
  modality: PensionPlanModality;
  lunchesIncluded: number;
  dinnersIncluded: number;
  totalMeals: number;
  durationDays: number;
  isActive: boolean;
  demoOnly: true;
}

export interface PensionMembership {
  id: string;
  profileId: string;
  planId: string;
  modality?: PensionPlanModality;
  status: PensionMembershipStatus;
  publicPrice: number;
  agreedPrice?: number;
  discount?: number;
  paymentMethod: "in_person" | "cash" | "bank_transfer" | "in_person_card" | "other";
  paymentReference?: string;
  paymentDate?: string;
  startsAt?: string;
  expiresAt?: string;
  mealsAvailable?: number;
  observations?: string;
  activatedAt?: string;
  activatedBy?: string;
  suspensionReason?: string;
  cycles?: PensionMembershipCycle[];
  demoOnly: true;
}

export interface PensionMembershipCycle {
  id: string;
  startsAt?: string;
  expiresAt?: string;
  mealsGranted?: number;
  modality?: PensionPlanModality;
  publicPrice: number;
  agreedPrice?: number;
  discount?: number;
  paymentDate?: string;
  paymentMethod: PensionMembership["paymentMethod"];
  createdAt: string;
  createdBy: string;
  demoOnly: true;
}

export interface PensionMenuOption {
  id: string;
  name: string;
  category: PensionSelectionCategory;
  productId?: string;
  price: number;
  included: boolean;
  surplusPrice?: number;
  available: boolean;
  configured: boolean;
  imagePath?: string;
}

export interface PensionMenuCategory {
  id: string;
  label: string;
  category: PensionSelectionCategory;
  required: boolean;
  maxSelections: 1;
  options: PensionMenuOption[];
}

export interface PensionDailyMenu {
  id: string;
  date: string;
  branchId: string;
  period: Exclude<ServicePeriod, "closed">;
  published: boolean;
  serviceOpen: boolean;
  categories: PensionMenuCategory[];
  note?: string;
  demoOnly: true;
}

export interface PensionSelection {
  categoryId: string;
  optionId: string;
}

export interface PensionSurplusCalculation {
  basePrice: number;
  includedCredit: number;
  surplus: number;
  totalAdditional: number;
}

export interface PensionConsumption {
  id: string;
  membershipId: string;
  date: string;
  period: Exclude<ServicePeriod, "closed">;
  demoOrderId?: string;
  selections: PensionSelection[];
  mealsUsed: number;
  surplus: PensionSurplusCalculation;
  status: PensionConsumptionStatus;
  createdAt: string;
  demoOnly: true;
}

export interface PensionCalendarDay {
  date: string;
  menuPublished: boolean;
  consumed: boolean;
  available: boolean;
}

export interface PensionContext {
  profile: PensionDemoProfile;
  membership: PensionMembership | null;
  plan: PensionPlan;
}
