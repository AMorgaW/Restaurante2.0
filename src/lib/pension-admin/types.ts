import type { AdminRole } from "@/lib/admin/authorization";
import type { PensionMembership, PensionPlan, PensionMembershipStatus, PensionPlanModality } from "@/lib/pension/types";

export type PensionPaymentMethod = Exclude<PensionMembership["paymentMethod"], "in_person">;

export interface PensionPaymentInput {
  publicPrice: number;
  agreedPrice: number;
  paymentMethod: PensionPaymentMethod;
  paymentDate: string;
  paymentReference?: string;
  observations?: string;
  allowSurcharge?: boolean;
}

export interface PensionCycleInput extends PensionPaymentInput {
  modality?: PensionPlanModality;
  startsAt: string;
  expiresAt?: string;
  mealsAvailable?: number;
  confirmed: boolean;
}

export interface PensionAdminActor {
  role: AdminRole | null | undefined;
  id: string;
  now: string;
}

export interface PensionAdminSummary {
  byStatus: Record<PensionMembershipStatus, number>;
  pending: number;
  expiringSoon: number;
}

export interface PensionAdminRow {
  profileId: string;
  profileName: string;
  membership: PensionMembership;
  plan: PensionPlan;
  consumptions: number;
  surplusTotal: number;
}
