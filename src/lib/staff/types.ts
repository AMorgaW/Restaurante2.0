import type { AdminCapability, AdminRole } from "@/lib/admin/authorization";

export type StaffStatus = "invited" | "active" | "suspended" | "inactive";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  branchIds: string[];
  branchNames: string[];
  status: StaffStatus;
  joinedAt: string;
  lastAccessAt?: string;
  demoOnly: true;
}

export interface StaffView extends StaffMember {
  capabilities: AdminCapability[];
}

export interface StaffFilters {
  search: string;
  role: AdminRole | "all";
  branchId: string | "all";
  status: StaffStatus | "all";
}
