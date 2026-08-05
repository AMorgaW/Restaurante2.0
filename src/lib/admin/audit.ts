export type AdminAuditAction =
  | "employee_role_changed"
  | "employee_branch_changed"
  | "employee_suspended"
  | "employee_reactivated"
  | "employee_deactivated"
  | "pension_payment_recorded"
  | "pension_price_changed"
  | "pension_activated"
  | "pension_renewed"
  | "pension_suspended"
  | "pension_reactivated"
  | "pension_cancelled";

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  actor: string;
  entity: "employee" | "pension_membership";
  entityId: string;
  createdAt: string;
  summary: string;
  reason?: string;
  demoOnly: true;
}

export function createAdminAuditEntry(input: Omit<AdminAuditEntry, "id" | "demoOnly"> & { id?: string }): AdminAuditEntry {
  return { ...input, id: input.id ?? `audit-${input.entity}-${input.entityId}-${input.createdAt}`, demoOnly: true };
}
