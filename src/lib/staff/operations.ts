import { ADMIN_ROLES, type AdminRole } from "@/lib/admin/authorization";
import { isStaffRole } from "@/lib/staff/selectors";
import type { StaffMember, StaffStatus } from "@/lib/staff/types";

export type StaffErrorCode = "forbidden" | "not_found" | "invalid_role" | "invalid_branch" | "owner_protected" | "last_owner" | "invalid_status";

export class StaffDomainError extends Error {
  constructor(public readonly code: StaffErrorCode, message: string) {
    super(message);
    this.name = "StaffDomainError";
  }
}

function requireOwner(actorRole: AdminRole | null | undefined): void {
  if (actorRole !== "owner") throw new StaffDomainError("forbidden", "Solo el jefe puede modificar empleados demo.");
}

function findStaff(members: StaffMember[], id: string): StaffMember {
  const member = members.find((candidate) => candidate.id === id);
  if (!member) throw new StaffDomainError("not_found", "No encontramos ese empleado demo.");
  return member;
}

function replaceMember(members: StaffMember[], updated: StaffMember): StaffMember[] {
  return members.map((member) => member.id === updated.id ? updated : member);
}

export function changeStaffRole(members: StaffMember[], actorRole: AdminRole | null | undefined, employeeId: string, nextRole: unknown): StaffMember[] {
  requireOwner(actorRole);
  const member = findStaff(members, employeeId);
  if (member.role === "owner" || member.role === "admin") throw new StaffDomainError("owner_protected", "La cuenta del jefe o administrador delegado no se modifica desde este demo.");
  if (!isStaffRole(nextRole)) throw new StaffDomainError("invalid_role", `Cargo inválido. Usa uno de: ${ADMIN_ROLES.filter((role) => isStaffRole(role)).join(", ")}.`);
  return replaceMember(members, { ...member, role: nextRole });
}

export function assignStaffBranches(members: StaffMember[], actorRole: AdminRole | null | undefined, employeeId: string, branchIds: string[], validBranchIds: string[]): StaffMember[] {
  requireOwner(actorRole);
  const member = findStaff(members, employeeId);
  if (member.role === "owner") throw new StaffDomainError("owner_protected", "La cuenta del jefe conserva sus sucursales globales.");
  const unique = [...new Set(branchIds)];
  if (unique.length === 0 || unique.some((id) => !validBranchIds.includes(id))) throw new StaffDomainError("invalid_branch", "Asigna al menos una sucursal válida.");
  return replaceMember(members, { ...member, branchIds: unique });
}

export function setStaffStatus(members: StaffMember[], actorRole: AdminRole | null | undefined, employeeId: string, status: StaffStatus): StaffMember[] {
  requireOwner(actorRole);
  const member = findStaff(members, employeeId);
  if (member.role === "owner") throw new StaffDomainError("owner_protected", "No puedes suspender ni retirar al último jefe demo.");
  if (member.status === status) throw new StaffDomainError("invalid_status", "El empleado ya tiene ese estado.");
  return replaceMember(members, { ...member, status });
}

export function countOwners(members: StaffMember[]): number {
  return members.filter((member) => member.role === "owner" && member.status === "active").length;
}
