import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

type StaffRole = "owner" | "admin" | "manager" | "kitchen" | "cashier" | "editor" | "support";
type StaffStatus = "invited" | "active" | "suspended" | "inactive";
type InventoryMovementType = "purchase" | "adjustment" | "waste";
type PensionStatusAction = "suspended" | "reactivated" | "cancelled" | "finalized";

async function unwrap<T>(operation: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await operation;
  if (error) throw error;
  return data;
}

/**
 * Adaptador del backend real. Recibe el cliente SSR de la solicitud para que
 * PostgreSQL autorice con auth.uid(); nunca crea identidad ni usa service_role.
 */
export function createSupabaseOperations(client: SupabaseClient<Database>) {
  return {
    manageStaff(input: {
      profileId: string;
      role: StaffRole;
      status: StaffStatus;
      branchIds: string[];
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("manage_staff_profile", {
        target_profile: input.profileId,
        target_role: input.role,
        target_status: input.status,
        target_branch_ids: input.branchIds,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    applyInventoryMovement(input: {
      itemId: string;
      type: InventoryMovementType;
      delta: number;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("apply_inventory_movement", {
        target_item: input.itemId,
        target_type: input.type,
        target_delta: input.delta,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    reverseInventoryConsumption(input: {
      movementId: string;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("reverse_inventory_consumption", {
        original_movement: input.movementId,
        reversal_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    requestPensionMembership(planId: string, branchId: string, idempotencyKey: string) {
      return unwrap(client.rpc("request_pension_membership", {
        target_plan: planId,
        target_branch: branchId,
        target_idempotency_key: idempotencyKey,
      }));
    },

    changePensionStatus(input: {
      membershipId: string;
      action: PensionStatusAction;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("change_pension_membership_status", {
        target_membership: input.membershipId,
        target_action: input.action,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    /** Prefer `SupabasePensionRepository` for app flows; thin RPC wrappers for ops/tests. */
    createAndActivatePensionMembership(input: {
      customerId: string;
      planId: string;
      branchId: string;
      agreedPrice: number;
      paymentMethod: string;
      paymentReference: string;
      paymentDate: string;
      startsAt: string;
      mealLimit: number;
      allowSurcharge: boolean;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("create_and_activate_pension_membership", {
        target_customer: input.customerId,
        target_plan: input.planId,
        target_branch: input.branchId,
        target_agreed_price: input.agreedPrice,
        target_payment_method: input.paymentMethod,
        target_payment_reference: input.paymentReference,
        target_payment_date: input.paymentDate,
        target_starts_at: input.startsAt,
        target_meal_limit: input.mealLimit,
        target_allow_surcharge: input.allowSurcharge,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    activatePensionMembership(input: {
      membershipId: string;
      agreedPrice: number;
      paymentMethod: string;
      paymentReference: string;
      paymentDate: string;
      startsAt: string;
      endsAt: string;
      mealLimit: number;
      allowSurcharge: boolean;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("activate_pension_membership", {
        target_membership: input.membershipId,
        target_agreed_price: input.agreedPrice,
        target_payment_method: input.paymentMethod,
        target_payment_reference: input.paymentReference,
        target_payment_date: input.paymentDate,
        target_starts_at: input.startsAt,
        target_ends_at: input.endsAt,
        target_meal_limit: input.mealLimit,
        target_allow_surcharge: input.allowSurcharge,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    renewPensionMembership(input: {
      membershipId: string;
      agreedPrice: number;
      paymentMethod: string;
      paymentReference: string;
      paymentDate: string;
      startsAt: string;
      endsAt: string;
      mealLimit: number;
      allowSurcharge: boolean;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("renew_pension_membership", {
        target_membership: input.membershipId,
        target_agreed_price: input.agreedPrice,
        target_payment_method: input.paymentMethod,
        target_payment_reference: input.paymentReference,
        target_payment_date: input.paymentDate,
        target_starts_at: input.startsAt,
        target_ends_at: input.endsAt,
        target_meal_limit: input.mealLimit,
        target_allow_surcharge: input.allowSurcharge,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    savePensionMenuDraft(input: {
      branchId: string;
      serviceDate: string;
      period: string;
      note: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("save_pension_menu_draft", {
        target_branch: input.branchId,
        target_service_date: input.serviceDate,
        target_period: input.period,
        target_note: input.note,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    upsertPensionMenuItem(input: {
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
    }) {
      return unwrap(client.rpc("upsert_pension_menu_item", {
        target_menu: input.menuId,
        target_category: input.category,
        target_category_label: input.categoryLabel,
        target_is_required: input.isRequired,
        target_max_selections: input.maxSelections,
        target_menu_item_id: input.menuItemId,
        target_is_included: input.isIncluded,
        target_surcharge_amount: input.surchargeAmount,
        target_is_available: input.isAvailable,
        target_display_order: input.displayOrder,
      }));
    },

    publishPensionMenu(input: {
      menuId: string;
      expectedStatus: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("publish_pension_menu", {
        target_menu: input.menuId,
        expected_status: input.expectedStatus,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    closePensionMenu(input: {
      menuId: string;
      expectedStatus: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("close_pension_menu", {
        target_menu: input.menuId,
        expected_status: input.expectedStatus,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    setPensionDeliveryFee(input: {
      branchId: string;
      fee: number;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("set_pension_delivery_fee", {
        target_branch: input.branchId,
        target_fee: input.fee,
        target_idempotency_key: input.idempotencyKey,
      }));
    },

    reversePensionOrderConsumption(input: {
      orderId: string;
      reason: string;
      idempotencyKey: string;
    }) {
      return unwrap(client.rpc("reverse_pension_order_consumption", {
        target_order: input.orderId,
        target_reason: input.reason,
        target_idempotency_key: input.idempotencyKey,
      }));
    },
  };
}
