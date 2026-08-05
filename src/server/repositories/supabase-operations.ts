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
  };
}
