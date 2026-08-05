import { adminRoleCan, isAdminRole, type AdminCapability, type AdminRole } from "@/lib/admin/authorization";
import type { EmployeeDemoProfile } from "@/lib/employee/types";
import type { StaffFilters, StaffMember, StaffView } from "@/lib/staff/types";

export type EmployeeRole = Exclude<AdminRole, "owner" | "admin">;

export function getStaffCapabilities(role: AdminRole): AdminCapability[] {
  const capabilities: AdminCapability[] = ["read-catalog", "read-inventory", "read-orders", "transition-orders", "read-history", "read-incidents", "manage-employees", "read-pension-memberships", "manage-pension-memberships"];
  return capabilities.filter((capability) => adminRoleCan(role, capability));
}

export function toStaffView(member: StaffMember): StaffView {
  return { ...member, capabilities: getStaffCapabilities(member.role) };
}

export function filterStaff(members: StaffMember[], filters: StaffFilters): StaffMember[] {
  const search = filters.search.trim().toLocaleLowerCase("es");
  return members.filter((member) => {
    if (search && !`${member.name} ${member.email}`.toLocaleLowerCase("es").includes(search)) return false;
    if (filters.role !== "all" && member.role !== filters.role) return false;
    if (filters.branchId !== "all" && !member.branchIds.includes(filters.branchId)) return false;
    if (filters.status !== "all" && member.status !== filters.status) return false;
    return true;
  });
}

export function countStaffByStatus(members: StaffMember[]): Record<StaffMember["status"], number> {
  return {
    invited: members.filter((member) => member.status === "invited").length,
    active: members.filter((member) => member.status === "active").length,
    suspended: members.filter((member) => member.status === "suspended").length,
    inactive: members.filter((member) => member.status === "inactive").length,
  };
}

export function isStaffRole(role: unknown): role is EmployeeRole {
  return isAdminRole(role) && role !== "owner" && role !== "admin";
}

export function getStaffStatusLabel(status: StaffMember["status"]): string {
  return ({ invited: "Invitado", active: "Activo", suspended: "Suspendido", inactive: "Inactivo" } as const)[status];
}

export function getStaffRoleLabel(role: AdminRole): string {
  return ({ owner: "Jefe / Propietario", admin: "Administrador", manager: "Gerente", kitchen: "Cocina", cashier: "Caja", editor: "Editor", support: "Atención" } as const)[role];
}

export function toEmployeeDemoProfile(member: StaffMember): EmployeeDemoProfile | null {
  if (!isStaffRole(member.role)) return null;
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    branchId: member.branchIds[0] ?? "",
    branchName: member.branchNames[0] ?? "Sucursal sin asignar",
  };
}
