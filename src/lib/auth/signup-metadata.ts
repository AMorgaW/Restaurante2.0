/**
 * Metadata enviada en el registro público. Solo campos no privilegiados;
 * el rol comercial lo fija el trigger `private.handle_new_user` → customer.
 */

const PRIVILEGED_KEYS = new Set([
  "role",
  "staff_status",
  "staffStatus",
  "branch_id",
  "branchId",
  "branch_ids",
  "branchIds",
  "membership",
  "membership_status",
  "membershipStatus",
  "permissions",
  "is_staff",
  "isStaff",
  "admin",
  "owner",
  "employee",
]);

export type PublicSignupInput = {
  name?: unknown;
  phone?: unknown;
  [key: string]: unknown;
};

/** Conserva únicamente nombre/teléfono sanitizados; ignora cualquier campo privilegiado. */
export function buildPublicSignupMetadata(input: PublicSignupInput): Record<string, string> {
  const metadata: Record<string, string> = {};

  if (typeof input.name === "string") {
    const name = input.name.trim().replace(/\s+/g, " ").slice(0, 120);
    if (name.length > 0) metadata.name = name;
  }

  if (typeof input.phone === "string") {
    const phone = input.phone.trim().replace(/[^\d+\s()-]/g, "").slice(0, 32);
    if (phone.length >= 7) metadata.phone = phone;
  }

  return metadata;
}

/** True si el payload del cliente intentó inyectar campos de rol o permisos. */
export function signupPayloadAttemptsPrivilegeEscalation(input: PublicSignupInput): boolean {
  return Object.keys(input).some((key) => PRIVILEGED_KEYS.has(key));
}
